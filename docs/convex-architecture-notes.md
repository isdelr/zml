# Convex Architecture Notes

## Scope
- Backend surface is the `convex/` folder, excluding generated code in `convex/_generated`.
- Frontend callsites consume Convex functions through `lib/convex/api.ts` as the app-level contract boundary.

## Domain Modules
- `convex/leagues.ts`: league lifecycle, membership, standings, league stats orchestration.
- `convex/rounds.ts`: round lifecycle, transitions, scheduling entrypoints.
- `convex/submissions.ts`: submission CRUD, duplicate checks, comments, moderation flags.
- `convex/votes.ts`: vote casting and vote-finalization checks.
- `convex/listenProgress.ts`: round-scoped listen tracking.
- `convex/notifications.ts`: notification persistence, unread aggregate maintenance, push scheduling.
- `convex/webPush.ts` and `convex/webPushActions.ts`: subscription state (DB) and push delivery (external I/O).
- `convex/files.ts`: upload URL and metadata sync actions.

## Boundary Rules
- `query` and `internalQuery`: read-only paths.
- `mutation` and `internalMutation`: state changes and transactional domain logic.
- `action` and `internalAction`: external I/O and orchestration-heavy work.
- Round transition side effects are centralized in `lib/convex-server/rounds/transitions.ts`.

## Performance Rules
- Use `.withIndex(...)` for operational reads whenever possible.
- Avoid unbounded table scans in hot paths.
- Prefer bounded reads (`.take(...)`) for search and duplicate detection workflows.
- Batch document loads by ID and map in memory to avoid per-item lookup fanout.

## Data Model Notes
- Zero-data baseline: schema and contracts are optimized for new data only.
- Required normalized submission fields:
  - `normalizedSongTitle`
  - `normalizedArtist`
- Round-scoped listen progress is required:
  - `listenProgress.roundId`
- Notification cleanup uses explicit `createdAt` with `by_created_at` index.

## Aggregates and Counters
- Aggregates:
  - `unreadNotifications`
  - `membershipsByUser`
  - `submissionsByUser`
- Counters:
  - `memberCounter`
  - `submissionCounter`
  - `voterCounter`

## Validation Loop
- `npx tsc --noEmit --project convex/tsconfig.json`
- `npx eslint convex/**/*.ts` (or targeted file sets per change)
- `npm run convex:inventory`

