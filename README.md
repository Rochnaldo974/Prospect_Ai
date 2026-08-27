# Prospect AI

Moteur qui surveille des entreprises françaises, détecte celles qui présentent aujourd'hui
les meilleurs signaux commerciaux, et attribue automatiquement les 5 meilleures à chaque
freelance du web.

L'architecture complète est décrite dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Démarrage

Prérequis : Node 24+, pnpm 11+, Docker.

```bash
pnpm install
pnpm db:start          # démarre Supabase en local (première fois : ~5 min de pull d'images)
cp .env.example .env.local   # puis renseigner les clés affichées par db:start
pnpm seed:dev          # crée les comptes de développement
pnpm dev               # http://localhost:3000
```

Comptes de développement créés par `pnpm seed:dev` :

| Compte | Mot de passe | Rôle |
|---|---|---|
| `admin@prospect.local` | `admin123456` | admin |
| `paul@prospect.local` | `paul123456` | user |

Services locaux : app `:3000` · API Supabase `:54321` · Postgres `:54322` ·
Studio `:54323` · boîte mail de test `:54324`.

---

## Structure

```
apps/web        Next.js App Router — application utilisateur + console admin (Vercel)
apps/worker     Worker Node long-running — pipeline de découverte et d'attribution
packages/core   Logique métier partagée par les deux
supabase/       Migrations SQL
tests/          Tests unitaires et d'intégration
docs/           Architecture
```

Le pipeline ne tourne **pas** sur Vercel : les jobs de crawl dépassent largement les
limites du serverless. Le worker est un processus séparé qui parle à la même base ;
la file de jobs est une table Postgres exploitée avec `FOR UPDATE SKIP LOCKED`.

`pg_cron` **planifie** — chaque entrée se contente d'insérer un job. Il n'exécute
jamais de logique métier, ce qui permettra de le remplacer sans toucher au moteur.
Voir [`apps/worker/README.md`](apps/worker/README.md) pour ajouter un handler.

---

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | serveur de développement Next.js |
| `pnpm dev:worker` | worker en mode watch — **à arrêter avant de lancer les tests**, sinon il consomme leurs jobs |
| `pnpm typecheck` | vérification des types sur tout le workspace |
| `pnpm lint` | ESLint |
| `pnpm test` | tous les tests |
| `pnpm test:unit` | tests unitaires seuls (sans base) |
| `pnpm test:integration` | tests d'intégration (nécessite `pnpm db:start`) |
| `pnpm db:reset` | réapplique toutes les migrations à zéro |
| `pnpm db:diff <nom>` | génère une migration depuis les changements du schéma |
| `pnpm db:types` | régénère les types TypeScript depuis la base |
| `pnpm seed:dev` | (re)crée les comptes de développement |
| `pnpm seed:companies [n]` | génère n commerces locaux fictifs avec signaux et opportunités |
| `pnpm ingest:csv <fichier>` | ingère un CSV depuis le disque (`--sirene`, `--local-commerce`, `--dry-run`) |
| `pnpm discover osm <ville>…` | découverte OpenStreetMap (téléphone, site, SIRET) |
| `pnpm discover bodacc` | événements datés BODACC (`--days n`, `--dept 49,75`) |

---

## Conventions

- **TypeScript strict**, `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes` activés.
  Pas de `any` sans justification écrite.
- **Aucune logique métier dans React.** Les composants appellent le service layer de
  `packages/core`.
- **Validation Zod** à toute frontière : entrées de formulaire, réponses de sources
  externes, sorties de LLM.
- **Deux couches d'autorisation distinctes**, à ne jamais confondre : les `GRANT`
  décident quelles tables un rôle peut toucher, les policies RLS décident quelles lignes
  il voit. Les tables du moteur ne reçoivent jamais de grant pour `authenticated`.
- **Le rôle admin se vérifie côté serveur.** L'accès à la base admin passe
  exclusivement par `getAdminDb()`, qui appelle `requireAdmin()` avant de rendre le
  client `service_role` — il est donc impossible d'obtenir ce client dans une page
  admin sans que le contrôle du rôle ait eu lieu. Le module est marqué `server-only`.
- La clé `service_role` ne quitte jamais le serveur et n'est jamais préfixée `NEXT_PUBLIC_`.

### Ingérer le répertoire SIRENE

L'API Sirene de l'INSEE est limitée à quelques dizaines de requêtes par minute :
elle ne permet pas de constituer un socle national. Le chemin retenu est le
**fichier open data** publié sur data.gouv.fr, gratuit et sans clé.

```bash
# Toujours mesurer d'abord
pnpm ingest:csv StockEtablissement.csv --sirene --local-commerce --dry-run

# Puis ingérer
pnpm ingest:csv StockEtablissement.csv --sirene --local-commerce
```

L'API reste pertinente pour l'incrémental quotidien, pas pour le stock.

Le préréglage SIRENE applique le statut de diffusion : **seul le statut « O »
(diffusible) est marqué prospectable**. Les statuts « P » (diffusion partielle)
et « N » sont ingérés mais exclus de la prospection — c'est le choix prudent,
une part importante des entrepreneurs individuels n'étant pas en diffusion
complète.

Pour un fichier de quelques milliers de lignes, `/admin/import` fait la même
chose avec un aperçu des colonnes reconnues.

### Sources de données

| Source | Apporte | Coût | Clé |
|---|---|---|---|
| **SIRENE** (open data) | identité, NAF, effectif, date de création, statut de diffusion | gratuit | non |
| **OpenStreetMap** (Overpass) | **téléphone, site, e-mail** + `ref:FR:SIRET` | gratuit | non |
| **BODACC** | événements datés : créations, cessions, procédures collectives | gratuit | non |
| Recherche d'entreprises (DINUM) | SIRENE + **coordonnées géographiques**, filtrable NAF × code postal | gratuit | non |
| Base Adresse Nationale | géocodage, normalisation d'adresse | gratuit | non |

**OpenStreetMap est la source qui résout le problème central.** SIRENE dit
qui existe mais ne donne aucun moyen de joindre l'entreprise. OSM apporte le
contact — et pour une part importante des commerces français, un
`ref:FR:SIRET` qui rattache le point de vente au répertoire de façon
déterministe, sans aucun rapprochement approché.

Mesuré sur une découverte réelle (Angers, 891 commerces) :

```
géolocalisées      100 %
avec SIRET          54 %   ← rattachement déterministe à SIRENE
avec téléphone      33 %   ← gate de contact du V1
avec site web       27 %
SIRET + joignable   19 %
```

La couverture varie fortement selon la densité de contribution locale :
Lyon et Bordeaux dépassent 40 % de sites, La Réunion plafonne à 13 %.

**BODACC est le flux d'événements datés** qui permet au moteur de répondre
« pourquoi maintenant ». Il produit aussi des **exclusions** : une entreprise
en redressement judiciaire ou radiée est retirée de la prospection — c'est
inefficace de la démarcher, et c'est déplacé.

### SIREN, SIRET, et ce que le produit prospecte

Le **SIREN** identifie l'unité légale, le **SIRET** l'établissement. Une chaîne
de trois boulangeries a un SIREN et trois SIRET. Le produit prospecte des
établissements — c'est le point de vente qu'on appelle. En conséquence :

- `siret` est unique, `siren` ne l'est pas ;
- un candidat portant un SIRET ne se rapproche jamais par SIREN, sous peine de
  fusionner un magasin avec le siège ;
- le **domaine n'est pas unique** non plus : les enseignes de réseau renvoient
  toutes vers le site de la marque. Le rapprochement par domaine n'est retenu
  que s'il désigne une seule entreprise.

### Déduplication

Les clés exactes — SIRET, SIREN, domaine — traitent la majorité des cas à
l'ingestion. Le reste passe par un rapprochement approché : nom, téléphone,
adresse, proximité géographique.

Le rapprochement se fait **en base**, jamais en mémoire. Comparer chaque
entreprise à toutes les autres est en O(n²) : à trois millions de lignes, c'est
4,5 × 10¹² comparaisons. Quatre voisinages indexés restreignent les candidats
avant toute comparaison.

```
≥ 0,90   fusion automatique
≥ 0,70   mise en revue dans /admin/duplicates
<  0,70  entreprises distinctes
```

Le seuil de fusion est volontairement haut. **Une fusion abusive détruit de la
donnée et fait disparaître un prospect ; un doublon subsistant ne coûte qu'une
ligne** — et sera repéré plus tard, quand une source aura apporté un SIRET.

**Deux SIRET différents ne fusionnent jamais**, quel que soit le faisceau
d'indices : ce sont deux établissements. Un centre commercial en aligne des
dizaines à la même adresse, avec des noms voisins. La règle est dans la
fonction de fusion elle-même, pas seulement dans le scoring.

La pondération du nom est **quadratique**, calibrée sur des similarités
mesurées :

| Paire | Similarité |
|---|---|
| « BOULANGERIE MOREAU » / « Boulangerie Moreau SARL » | 1,000 |
| « Le Fournil de la Gare » / « Fournil de la Gare » | 0,905 |
| « GARAGE DUBOIS » / « GARAGE DUBOIS ET FILS » | 0,636 |
| « Carrefour City » / « Carrefour Market » | 0,476 |

La zone 0,40 – 0,70 est celle des enseignes d'un même réseau. Le carré l'écrase
tout en préservant le haut de l'échelle.

Le poids du domaine est **dégressif** : porté par trois entreprises ou plus, il
désigne un réseau et ne prouve aucune identité. Deux Biocoop distants de deux
kilomètres partagent biocoop.fr sans être le même magasin.

Sur 898 commerces angevins réels : 413 examinés en 0,8 s, **4 paires signalées**,
aucune fusion automatique. Un taux de revue de 0,4 % reste tenable par un humain.

### Choix de performance

Mesures relevées sur la base locale, à l'échelle indiquée.

| Chemin | Avant | Après | Levier |
|---|---|---|---|
| Ingestion — création | 60 lignes/s | **4 800 lignes/s** | écriture par lots |
| Ingestion — fusion | 500 lignes/s | **4 600 lignes/s** | patches groupés en une instruction SQL |
| Liste admin (300 k) | 550 ms | **1,8 ms** | agrégats dénormalisés + index de tri |
| Options de filtre | 2 requêtes × 5 000 lignes | **0,3 ms** | vue matérialisée |
| Vue d'ensemble | 82 ms | **0,07 ms** | compteurs précalculés |

À 4 800 lignes/s, ingérer 4 millions d'établissements prend une quinzaine de
minutes au lieu de dix-huit heures.

Trois principes en découlent :

- **Rien de ligne par ligne sur un chemin de masse.** Chaque aller-retour coûte
  3,5 ms en local et dix fois plus sur une base distante. Les lots passent par
  des fonctions SQL appelées en POST — avec `in(...)`, 500 identifiants font
  dépasser la limite d'URL de la passerelle.
- **Ce qui sert au tri est dénormalisé.** Trier sur un agrégat calculé oblige à
  le calculer pour toute la table, quel que soit l'index. Les compteurs vivent
  donc sur la ligne d'entreprise, maintenus par des triggers **au niveau
  instruction** — un trigger par ligne multiplierait le coût d'une écriture en
  lot par le nombre de lignes du lot. Surcoût mesuré : +23 %.
- **Ce qui décrit un état est précalculé.** Les compteurs de la vue d'ensemble
  et les valeurs des filtres n'ont pas besoin d'être exacts à la seconde.

### Partitions dans un schéma dédié

`website_snapshots` et `company_events` sont partitionnées par mois, et leurs
partitions vivent dans le schéma `partitions`. Elles disparaissent ainsi des types
générés, de Studio et de la surface interrogeable, sans changer la moindre requête :
tout passe par la table parente dans `public`.

### TypeScript 5.9 et non 7

TypeScript 7 est disponible mais `typescript-eslint` ne le supporte pas encore
(`>=4.8.4 <6.1.0`). Le projet reste sur 5.9.3 ; la montée en version sera un bump d'une
ligne le jour où l'écosystème suit.

---

## Avancement

- [x] **Phase 0** — monorepo, Next.js, Supabase, authentification, migrations, CI
- [x] **Phase 1** — schéma métier complet, invariants d'attribution, file de jobs
- [x] **Phase 2** — console admin : entreprises, fiche détaillée, débogueur de scoring, jobs
- [x] **Phase 3** — worker, exécution des jobs, planification pg_cron
- [x] **Phase 4** — normalisation, ingestion CSV et SIRENE
- [x] **Phase 4b** — sources externes : OpenStreetMap et BODACC
- [x] **Phase 5** — déduplication approchée
- [ ] Phase 6 — résolution des sites web
- [ ] Phases 4-17 — voir `docs/ARCHITECTURE.md`

### Surface exposée aux utilisateurs

Cinq tables seulement sont accessibles au rôle `authenticated`, et aucune à `anon` :

| Table | Droits |
|---|---|
| `profiles` | SELECT, UPDATE (hors colonnes privilégiées) |
| `user_preferences` | SELECT, UPDATE |
| `daily_batches` | SELECT |
| `assignment_cards` | SELECT |
| `assignments` | SELECT, UPDATE (suivi de contact uniquement) |

`companies`, `signals`, `opportunities` et le reste du moteur ne sont accessibles
qu'au rôle `service_role`. Les privilèges par défaut du schéma `public` ont été
inversés : une nouvelle table est invisible tant qu'un GRANT explicite ne l'ouvre pas.
