# Convex Migration Runbook

## Baseline Assumption
- The project currently uses a zero-data baseline.
- Legacy production backfills are intentionally out of scope unless explicitly requested.

## Current Migration Surface
- `convex/migrations.ts` keeps only active aggregate backfills:
  - notifications -> unread aggregate
  - memberships -> memberships aggregate
  - submissions -> submissions aggregate
- Migration runner export: `run`.

## When to Add a Migration
- Add a migration only when one of these is true:
  - existing persisted data must be transformed to satisfy a new required schema contract
  - aggregate/component derived state must be rebuilt
  - an index/data rewrite cannot be handled by code-only forward compatibility

## How to Add a Migration
1. Define a new migration with `migrations.define(...)`.
2. Make `migrateOne` idempotent.
3. Keep per-document logic bounded and deterministic.
4. Add a short note in `docs/convex-refactor-plan.md` progress log.
5. Validate with:
   - `npx tsc --noEmit --project convex/tsconfig.json`
   - `npx eslint convex/migrations.ts`

## Running Migrations
- Use the exported runner (`run`) through your normal Convex migration execution flow.
- Execute in non-production/dev first, verify invariants, then run in target deployment.

## Post-Migration Checks
- Refresh function/reference inventory:
  - `npm run convex:inventory`
- Re-run lint and typecheck.
- Confirm affected frontend callsites still match contracts.

