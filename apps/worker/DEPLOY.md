# Déployer le worker

Le worker est un processus long : il réclame ses jobs dans Postgres
(`job_queue`, verrouillage `SKIP LOCKED`), les exécute, et rend compte.
C'est `pg_cron`, dans la base, qui décide QUAND un job existe — le worker
n'a donc besoin ni d'horloge, ni de port ouvert, ni d'être unique : deux
workers ne se marcheront jamais dessus.

Il lui faut exactement deux choses :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | l'URL du projet Supabase (pas un secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé service — **secret**, jamais commitée |

Facultatives : `WORKER_ID` (nom dans les logs), `WORKER_CONCURRENCY`
(4 par défaut), `WORKER_POLL_INTERVAL_MS` (2000 par défaut).

L'image a été validée au banc : démarrage, connexion, et surtout l'arrêt
propre — SIGTERM cesse la réclamation et laisse finir les jobs en cours
(`docker stop` → « Arrêt demandé » → sortie code 0).

## Préalable : la base hébergée doit être prête

Le worker déployé pointera sur le Supabase hébergé, qui doit d'abord
recevoir le schéma, les tâches pg_cron, et les données. Depuis la racine :

```bash
supabase link --project-ref tjeqsghmlwxmedumsdyt
supabase db push          # applique les migrations (schéma + pg_cron)
```

L'import des données (4,59 M de domaines, entreprises, signaux) est une
opération à part entière — voir la section « Import initial » plus bas.
**Un worker branché sur une base vide tourne sans rien faire : c'est sans
danger, mais sans intérêt.**

## Voie recommandée : Fly.io (région Paris)

Pourquoi Fly : la machine vit à Paris (`cdg`), même ville que la base
(AWS eu-west-3) ; le déploiement tient en une commande ; ~4 $/mois pour la
taille configurée (shared-cpu-1x, 512 Mo) ; redémarrage automatique.

Une seule fois :

```bash
brew install flyctl
fly auth signup                 # ou fly auth login
fly launch --no-deploy --copy-config   # lit fly.toml, crée l'app sans déployer
fly secrets set SUPABASE_SERVICE_ROLE_KEY="<la clé service du projet hébergé>"
```

La clé service du projet hébergé se trouve dans le tableau de bord
Supabase → Settings → API → `service_role`. Ce n'est PAS celle du `.env`
local, qui n'ouvre que la base de développement.

Puis, à chaque mise en production du worker :

```bash
fly deploy
```

Vérifier :

```bash
fly logs            # doit montrer « Démarrage du worker » puis les jobs
fly status
```

`fly deploy` remplace la machine proprement : SIGTERM, cinq minutes de
grâce (`kill_timeout`), les jobs en cours se terminent.

## Alternative : un VPS

Pour ~4 €/mois (Hetzner CX22, Scaleway DEV1-S…), plus de mémoire pour
moins cher, mais l'OS est à votre charge (mises à jour, Docker, accès SSH).

```bash
# sur le VPS, une fois Docker installé et le dépôt cloné :
cd Prospect_Ai
printf '%s\n%s\n' \
  'NEXT_PUBLIC_SUPABASE_URL=https://tjeqsghmlwxmedumsdyt.supabase.co' \
  'SUPABASE_SERVICE_ROLE_KEY=<clé service>' > apps/worker/.env
docker compose -f apps/worker/docker-compose.yml up -d --build
docker compose -f apps/worker/docker-compose.yml logs -f
```

`restart: unless-stopped` relance le worker après un crash ou un reboot.

## Import initial des données

Les 4,59 M de domaines AFNIC se réimportent depuis la source plutôt que de
transférer la base locale : `scripts/import-afnic.mjs` pointé sur la base
hébergée (mêmes deux variables d'environnement). Compter ~1 Go en base.
Les entreprises, signaux et opportunités se reconstruisent ensuite par les
jobs eux-mêmes — c'est le pipeline normal, pas une restauration.

## Ce qui n'est PAS l'affaire du worker

- **Planifier** : pg_cron insère les jobs ; le worker les consomme.
- **Servir le site** : l'application Next.js se déploie ailleurs
  (Vercel ou équivalent) ; ce conteneur n'expose aucun port.
- **Être seul** : en cas de gros import, lancer un second worker avec un
  autre `WORKER_ID` est sûr par construction.
