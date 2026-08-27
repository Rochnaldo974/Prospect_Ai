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
- [ ] Phase 5 — déduplication approchée
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
