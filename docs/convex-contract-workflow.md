# Convex Contract Workflow

## Goal
- Keep backend and frontend contracts synchronized in every Convex change.
- Operate with a zero-data baseline and local-first development.

## Required Change Flow
1. Update backend function/schema in `convex/`.
2. Update frontend callsites in the same change set.
3. Keep frontend imports on `lib/convex/api.ts` (do not import generated API directly in UI code).
4. Run validation:
   - `npx tsc --noEmit --project convex/tsconfig.json`
   - `npm run lint`
   - `npm run convex:inventory`
   - `npm run test:convex`
5. Update `docs/convex-refactor-plan.md` progress log for notable contract or schema changes.

## Query/Mutation/Action Discipline
- Query: read only.
- Mutation: DB writes and state transitions.
- Action: external I/O and orchestration that does not fit transactional mutation logic.

## PR Checklist
- Frontend references updated for every changed backend function signature.
- No new unsafe cast patterns in backend/frontend call paths.
- Indexed query path used for high-traffic reads.
- Inventory and lint/typecheck pass locally.
