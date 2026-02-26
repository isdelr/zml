# Frontend Modernization Phase 4 Update

Date: 2026-02-08

## Completed (This Iteration)

### 1) Catch typing hardening
- Enabled `useUnknownInCatchVariables` in `tsconfig.json`.
- This enforces safer error handling by default in `catch` blocks.

### 2) JS compile hardening
- Set `allowJs: false` in `tsconfig.json`.
- Confirmed no frontend build/typecheck dependency on compiling `.js` sources.

### 3) Centralized frontend error-message helper
- Added `lib/errors.ts` with:
  - `toErrorMessage(error: unknown, fallback?: string): string`
- Replaced ad-hoc `instanceof Error` and cast-based patterns in touched FE modules, including:
  - `hooks/useRoundVoting.ts`
  - `components/round/SubmissionsList.tsx`
  - `components/round/SubmissionItem.tsx`
  - `components/league/LeagueHeader.tsx`
  - `components/league/LeagueJoinCard.tsx`
  - `components/SongSubmissionForm.tsx`
  - `components/EditSubmissionForm.tsx`
  - `components/MultiSongSubmissionForm.tsx`
  - `components/AlbumSubmissionForm.tsx`

### 4) Frontend `noUncheckedIndexedAccess` remediation (staged)
- Kept global `tsconfig.json` stable (no global `noUncheckedIndexedAccess` yet).
- Added staged strict config:
  - `tsconfig.frontend-strict.json`
  - strict check command: `npx tsc --noEmit --project tsconfig.frontend-strict.json`
- Resolved frontend strict-index issues in client-facing files:
  - `components/AlbumSubmissionForm.tsx`
  - `components/MultiSongSubmissionForm.tsx`
  - `components/BottomNavbar.tsx`
  - `components/LeaguePage.tsx`
  - `components/MusicPlayer.tsx`
  - `components/MySubmissionsPage.tsx`
  - `components/NowPlayingView.tsx`
  - `components/RoundDetail.tsx`
  - `components/league/stats/AwardCards.tsx`
  - `components/player/PlayerActions.tsx`
  - `components/player/PlayerProgress.tsx`
  - `components/round/SubmissionComments.tsx`
  - `components/round/SubmissionsList.tsx`
  - `hooks/useMusicPlayerStore.ts`
  - `hooks/useRoundVoting.ts`
  - `lib/music/comments.ts`
  - `lib/rounds/submission-order.ts`
  - `lib/youtube.ts`
  - `lib/convex-server/submissions/youtube.ts`
- Current strict status:
  - Frontend paths are clean under `noUncheckedIndexedAccess`.
  - Remaining failures come from Convex backend/seed files pulled in transitively by generated Convex API types.

### 5) Dependency modernization for TS-focused stack
- Upgraded:
  - `typescript` -> `5.9.3`
  - `zod` -> `4.3.6`
  - `react-hook-form` -> `7.71.1`
- Revalidated lint/typecheck/tests after upgrade.

### 6) Residual error-handling normalization
- Replaced remaining ad-hoc `err.data?.message` / local `instanceof Error` patterns with `toErrorMessage(...)` in:
  - `components/league/settings/InviteTab.tsx`
  - `components/league/settings/MembersTab.tsx`
  - `components/round/RoundAdminControls.tsx`
  - `components/round/EditRoundDialog.tsx`
  - `components/round/SubmissionComments.tsx`
  - `components/BookMarkedPage.tsx`
  - `components/AdminSeedPage.tsx`
  - `components/NowPlayingView.tsx`
  - `app/api/storage-proxy/route.ts`
- Enhanced `lib/errors.ts` to also parse Convex-style nested payloads (`error.data.message`).

### 7) Advanced TS strict flags review (deferred by design)
- Evaluated `exactOptionalPropertyTypes` + `verbatimModuleSyntax` in dry-run mode.
- Result was high-churn and not clean for incremental rollout:
  - ~142 frontend errors
  - ~236 Convex/backend errors
- Deferred these two flags to a dedicated migration track to avoid mixing mechanical import rewrites + optional-property contract changes into active feature/refactor work.

### 8) Practical frontend strict gate added
- Added a documented strict-gate command:
  - `npx tsc --noEmit --project tsconfig.frontend-strict.json`
  - gate is evaluated against frontend paths while Convex-only strict backlog is tracked separately

## Validation
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run test:unit` passed (24 tests)
- `npm run test:e2e -- --project=chromium --grep "homepage renders with expected title"` passed
- `npx tsc --noEmit --project tsconfig.frontend-strict.json` still reported Convex backend/seed strict errors (expected in staged rollout).

## Remaining Phase 4 Candidates
- Promote `noUncheckedIndexedAccess: true` from staged frontend scope to full project scope once Convex backend/seed strict backlog is addressed.
