# ZML Self-Hosted Stack (Next.js + Convex + Backblaze B2)

This project is now set up for container-first self-hosting.

What runs in containers:
- Next.js web app
- PostgreSQL database (Convex persistence)
- Convex self-hosted backend
- Convex dashboard
- Convex function sync job (`convex dev --once` in prod)

What stays external:
- Backblaze B2 bucket (as requested)

## Why this setup

- Next.js uses `output: "standalone"` and a multi-stage Docker build (current recommended self-host pattern).
- Convex uses the official self-hosted backend/dashboard images and self-hosted CLI flow.
- File uploads and signed URLs use Backblaze B2's S3-compatible API.
- OG image generation uses `next/og` (no Vercel package dependency).

## Files added for container workflows

- `Dockerfile`
- `.dockerignore`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `.env.docker.dev.example`
- `.env.docker.prod.example`

## Development flow

1. Create your env file:
```bash
cp .env.docker.dev.example .env.docker.dev
```

2. Set `INSTANCE_SECRET` in `.env.docker.dev` to a hex string (recommended: 64 hex chars):
```bash
openssl rand -hex 32
```

3. Keep `INSTANCE_NAME` and `CONVEX_POSTGRES_DB` aligned:
- `INSTANCE_NAME=zml-dev` -> `CONVEX_POSTGRES_DB=zml_dev`
- use underscore in DB names where instance names use dashes

Important local port mapping for Convex:
- `CONVEX_CLOUD_ORIGIN=http://127.0.0.1:3210` (Convex API)
- `CONVEX_SITE_ORIGIN=http://localhost:3211` (HTTP routes like `/api/auth/signin/*`)
- `CONVEX_SITE_URL=http://localhost:3211`
- `postgres://localhost:5432` (local Postgres admin/debug access)

4. Generate a Convex admin key (first run only), then copy it into `.env.docker.dev` as `CONVEX_SELF_HOSTED_ADMIN_KEY`:
```bash
docker compose --env-file .env.docker.dev -f docker-compose.dev.yml up -d convex-backend
docker compose --env-file .env.docker.dev -f docker-compose.dev.yml exec convex-backend ./generate_admin_key.sh
```

5. Start the full dev stack (Postgres + Convex backend + dashboard + app):
```bash
npm run dev
```

6. Open:
- App: `http://localhost:3000`
- Convex dashboard: `http://localhost:6791`

To stop:
```bash
docker compose --env-file .env.docker.dev -f docker-compose.dev.yml down
```

To stop and remove local Convex + Postgres data:
```bash
docker compose --env-file .env.docker.dev -f docker-compose.dev.yml down -v
```

### Troubleshooting (dev)

- `Cannot prompt for input in non-interactive terminals. (Welcome to Convex! Would you like to login to your account?)`
  - Cause: `CONVEX_SELF_HOSTED_ADMIN_KEY` is missing or empty.
  - Fix: generate it and set it in `.env.docker.dev`:
    ```bash
    docker compose --env-file .env.docker.dev -f docker-compose.dev.yml up -d convex-backend
    docker compose --env-file .env.docker.dev -f docker-compose.dev.yml exec convex-backend ./generate_admin_key.sh
    ```

- `Error: missing _tables.by_id global`
  - Cause: local Convex data volume is stale or incompatible with the current backend image.
  - Fix: reset local Convex volume and start fresh:
    ```bash
    docker compose --env-file .env.docker.dev -f docker-compose.dev.yml down -v
    npm run dev
    ```

- `database "zml_dev" does not exist` (or another instance DB name)
  - Cause: `INSTANCE_NAME` and `CONVEX_POSTGRES_DB` are out of sync.
  - Fix: ensure `INSTANCE_NAME=my-instance` and `CONVEX_POSTGRES_DB=my_instance` in the same env file, then recreate volumes:
    ```bash
    docker compose --env-file .env.docker.dev -f docker-compose.dev.yml down -v
    npm run dev
    ```

## Production flow

1. Create production env file:
```bash
cp .env.docker.prod.example .env.docker.prod
```

2. Fill in production values, especially:
- `NEXT_PUBLIC_CONVEX_URL` (public Convex URL)
- `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `INSTANCE_SECRET`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `CONVEX_POSTGRES_DB`
- Discord, JWT/JWKS, B2, VAPID, API keys
- `B2_BUCKET`, `B2_ENDPOINT`, `B2_REGION`, `B2_KEY_ID`, `B2_APPLICATION_KEY`

`CONVEX_POSTGRES_DB` should match `INSTANCE_NAME` with `-` replaced by `_`.

`INSTANCE_SECRET` must be an even-length hex string (recommended: 64 hex chars). You can generate one with:
```bash
openssl rand -hex 32
```

`JWKS` for Convex Better Auth static-JWKS must be the Better Auth doc-array JSON (not a plain `{"keys":[...]}` JWK Set). Recommended way to set it:
```bash
npx convex run auth:getLatestJwks | npx convex env set JWKS
```

If you need to generate `CONVEX_SELF_HOSTED_ADMIN_KEY`:
```bash
docker compose --env-file .env.docker.prod -f docker-compose.prod.yml up -d convex-backend
docker compose --env-file .env.docker.prod -f docker-compose.prod.yml exec convex-backend ./generate_admin_key.sh
```

3. Build and start the stack:
```bash
docker compose --env-file .env.docker.prod -f docker-compose.prod.yml up -d --build
```

What happens in prod compose:
- `postgres` starts and becomes healthy
- `convex-backend` starts
- `convex-sync` syncs runtime env vars to Convex, pushes Convex functions/schema, then stays alive as a healthy gate service
- `web` starts only after `convex-sync` is healthy

For app updates:
```bash
docker compose --env-file .env.docker.prod -f docker-compose.prod.yml up -d --build convex-sync web
```

## Coolify deployment

`docker-compose.prod.yml` is now structured for Coolify Docker Compose deployments.

1. In Coolify, create a Docker Compose resource and point it at `docker-compose.prod.yml`.
2. Configure domains in Coolify:
- `web` on port `3000` (public app URL)
- `convex-backend` on port `3210` (public Convex URL)
- optional: `convex-dashboard` on port `6791` (admin/dashboard access)
3. Do not expose `postgres` publicly; keep it internal to the Docker network.
4. Set environment variables in Coolify using `.env.docker.prod.example` as the template.
5. Ensure `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`, and `CONVEX_SITE_URL` all match your public Convex backend URL.

Notes:
- Prod compose intentionally uses `expose` (not host `ports`) so Coolify handles ingress/routing.
- `convex-sync` intentionally idles after a successful sync so orchestrators (including Coolify) keep stack health green.
- In Coolify, the Compose file is the source of truth for service config; update the file and redeploy when changing service settings.
- If you ever introduce one-shot sidecar services in this stack, Coolify supports excluding them from deployment health checks via `exclude_from_hc=true` service comments.

## Self-hosting notes

- Put a reverse proxy (Caddy/Traefik/Nginx) in front for TLS and domain routing.
- Keep both `convex_data` and `postgres_data` volumes backed up.
- Backup Postgres periodically, for example:
  ```bash
  docker compose --env-file .env.docker.prod -f docker-compose.prod.yml exec -T postgres \
    sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
  ```
- Restore Postgres from a dump:
  ```bash
  cat backup.sql | docker compose --env-file .env.docker.prod -f docker-compose.prod.yml exec -T postgres \
    sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
  ```
- `NEXT_PUBLIC_*` values are compiled into the Next.js client bundle at image build time.

## Dev data seeding and simulation

Use the dev seeding utility to quickly create realistic leagues, rounds, submissions, votes, comments, bookmarks, notifications, listen progress, presence, and troll/ban examples.

It supports real local song files from your machine:
- pass files directly with `--song`
- pass folders recursively with `--songs-dir`
- optionally pass artwork with `--cover` / `--covers-dir`
- if no artwork is provided, generated SVG covers are uploaded automatically

Examples:
```bash
# List users so you can include your real account in seeded leagues
npm run dev:seed:users

# Seed namespace "dev" with local songs and include your account by email
npm run dev:seed -- --namespace dev \
  --user-email you@example.com \
  --songs-dir ~/Music/test-seed \
  --covers-dir ~/Pictures/covers

# Run additional activity simulation passes
npm run dev:seed:simulate -- --namespace dev --ticks 8

# Reset and remove seeded namespace data
npm run dev:seed:reset -- --namespace dev
```

You can also seed via a manifest JSON file:
```json
{
  "songs": [
    {
      "songPath": "/Users/me/Music/Artist - Song.mp3",
      "coverPath": "/Users/me/Pictures/song.jpg",
      "songTitle": "Song",
      "artist": "Artist",
      "duration": 212
    }
  ]
}
```

Then run:
```bash
npm run dev:seed -- --namespace dev --manifest ./seed-manifest.json
```

## npm scripts

Run this for a curated, grouped command list:

```bash
npm run scripts:help
```

Most-used commands:

- `npm run dev` -> local frontend + Convex watchers
- `npm run check` -> lint + typecheck
- `npm run test:unit` -> run Vitest
- `npm run test:e2e` -> run Playwright e2e
- `npm run convex:sync` -> one-time Convex sync locally
- `npm run build` -> production Turbopack build

Advanced:

- `docker compose --env-file .env.docker.dev -f docker-compose.dev.yml <args>` -> direct dev compose control
