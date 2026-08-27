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

---

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | serveur de développement Next.js |
| `pnpm dev:worker` | worker en mode watch |
| `pnpm typecheck` | vérification des types sur tout le workspace |
| `pnpm lint` | ESLint |
| `pnpm test` | tous les tests |
| `pnpm test:unit` | tests unitaires seuls (sans base) |
| `pnpm test:integration` | tests d'intégration (nécessite `pnpm db:start`) |
| `pnpm db:reset` | réapplique toutes les migrations à zéro |
| `pnpm db:diff <nom>` | génère une migration depuis les changements du schéma |
| `pnpm db:types` | régénère les types TypeScript depuis la base |
| `pnpm seed:dev` | (re)crée les comptes de développement |

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
- **Le rôle admin se vérifie côté serveur**, via `requireAdmin()`, jamais depuis le client.
- La clé `service_role` ne quitte jamais le serveur et n'est jamais préfixée `NEXT_PUBLIC_`.

### TypeScript 5.9 et non 7

TypeScript 7 est disponible mais `typescript-eslint` ne le supporte pas encore
(`>=4.8.4 <6.1.0`). Le projet reste sur 5.9.3 ; la montée en version sera un bump d'une
ligne le jour où l'écosystème suit.

---

## Avancement

- [x] **Phase 0** — monorepo, Next.js, Supabase, authentification, migrations, CI
- [ ] Phase 1 — schéma métier complet
- [ ] Phase 2 — console admin des entreprises
- [ ] Phase 3 — file de jobs et worker
- [ ] Phases 4-17 — voir `docs/ARCHITECTURE.md`
