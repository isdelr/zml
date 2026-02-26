# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZML is a self-hosted music league platform where users create leagues, submit songs, vote on rounds, and interact through a community voting system. Built with Next.js (App Router), Convex (self-hosted backend/database), and Backblaze B2 for file storage. Deployed via Docker Compose.

## Commands

```bash
npm run dev                  # Full stack: Next.js (3000) + Convex backend + Postgres + Dashboard (6791)
npm run dev:frontend         # Next.js only (port 3000)
npm run dev:backend          # Convex only (syncs env vars, then watches)
npm run build                # Production build (Turbopack)
npm run check                # Lint + typecheck (run before committing)
npm run lint                 # ESLint only
npm run typecheck            # TypeScript only
npm run test:unit            # Vitest unit tests
npm run test:e2e             # Playwright e2e tests
npm run test:e2e:smoke       # Quick smoke test (Chromium only)
npm run convex:sync          # One-time Convex function sync
npm run convex:codegen       # Regenerate Convex types
npm run dev:docker:reset     # Nuke Docker volumes and start fresh
```

## Architecture

### Tech Stack
- **Frontend:** Next.js 16 (App Router, Turbopack, standalone output), React 19, Tailwind CSS 4, Radix UI
- **Backend:** Convex (self-hosted) with PostgreSQL 16 persistence
- **Auth:** Better Auth with Discord OAuth, JWKS-based JWT signing
- **Storage:** Backblaze B2 (S3-compatible API) for audio files and album art
- **State:** Zustand (music player), Convex reactive queries (data), React Hook Form + Zod (forms)
- **PWA:** Serwist service worker

### Key Directories
- `app/` — Next.js App Router pages (Server Components by default, `"use client"` for interactive features)
- `components/` — React components organized by feature (`league/`, `player/`, `explore/`, `ui/` for Radix primitives)
- `hooks/` — Custom React hooks (`useMusicPlayerStore` for Zustand player, `useRoundVoting`, etc.)
- `lib/` — Shared utilities and configs
- `lib/convex/` — Frontend contract boundary for Convex API references and types
- `lib/convex-server/` — Backend-only helpers (permissions, media processing, vote limits)
- `convex/` — All backend functions: queries, mutations, actions, schema, crons, migrations

### Convex Backend Pattern
- `convex/schema.ts` — Database schema (all tables, indexes, validators)
- Backend files map to domain areas: `leagues.ts`, `rounds.ts`, `submissions.ts`, `votes.ts`, `bookmarks.ts`, `notifications.ts`, `presence.ts`, `listenProgress.ts`, `users.ts`
- Uses Convex plugins: Better Auth, Migrations, Sharded Counter, Aggregate
- HTTP routes in `convex/http.ts` (auth callbacks)

### Data Flow
- **Queries:** Read-only, cached, reactive (auto-update on changes)
- **Mutations:** Transactional database writes
- **Actions:** Side effects (B2 uploads, external API calls like Genius lyrics)

### Domain Model
Leagues → Rounds (submissions → voting → finished) → Submissions → Votes. Users have memberships in leagues. Rounds have configurable submission modes (single/multi/album). LeagueStats and LeagueStandings are computed aggregates.

## Important Conventions

### Convex API Import Rule (enforced by ESLint)
Frontend code must **never** import from `@/convex/_generated/api` directly. Always import through the centralized re-export:
```typescript
import { api } from "@/lib/convex/api";
```

### Type Derivation
Frontend types are derived from Convex function return types rather than duplicated:
```typescript
// lib/convex/types.ts
export type LeagueData = NonNullable<FunctionReturnType<typeof api.leagues.get>>;
```

### Styling
Tailwind classes only. Use `cn()` from `lib/utils.ts` for conditional class merging (clsx + tailwind-merge).

### Environment Variables
- See `.env.docker.dev.example` for all required variables
- `NEXT_PUBLIC_*` values are compiled into the client bundle at build time
- `INSTANCE_NAME` and `CONVEX_POSTGRES_DB` must stay in sync (dashes → underscores)

## Debugging

- **"missing _tables.by_id global":** Run `npm run dev:docker:reset` to clear stale volumes
- **"Cannot prompt for input":** Missing `CONVEX_SELF_HOSTED_ADMIN_KEY` — regenerate via Docker exec
- **E2E tests** use a separate dist dir (`.next-playwright`) on port 3005
- **Bundle analysis:** `npm run analyze:bundle`
