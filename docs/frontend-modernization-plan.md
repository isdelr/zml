# Frontend Modernization Master Plan (Next.js + React + TypeScript)

Date: 2026-02-08
Status: Completed for agreed frontend scope (authenticated Better Auth e2e and CI artifact wiring intentionally deferred)
Owner: Frontend modernization track

## 1) Objective
Modernize the frontend for maintainability, readability, and upgrade safety while preserving working behavior and avoiding unnecessary rewrites.

## 2) Scope
- Next.js App Router frontend (`app`, `components`, `hooks`, `lib`)
- Dependency health and replacement strategy
- TypeScript practices and stricter correctness
- Frontend quality gates (lint, typecheck, unit, e2e smoke)

## 3) Current State Snapshot

### 3.1 What is strong and should stay as-is
- App Router architecture is already in place and used correctly.
- Core stack is modern and current for framework runtime:
  - `next@16.1.6`
  - `react@19.2.4`
  - `tailwindcss@4`
- Convex import boundaries are enforced via ESLint restricted imports.
- Baseline quality gates are running and green:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run build`
  - `NEXT_DIST_DIR=tmp/.next-build-analyze npm run analyze:bundle`
  - `npm run test:e2e:smoke`

### 3.2 Structural refactor progress (largest files)
| File | Baseline size | Current size | Reduction |
|---|---:|---:|---:|
| `components/LeagueStats.tsx` | 933 | 237 | -74.6% |
| `components/CreateLeaguePage.tsx` | 928 | 131 | -85.9% |
| `components/league/LeagueSettingsDialog.tsx` | 637 | 80 | -87.4% |
| `components/RoundDetail.tsx` | 902 | 426 | -52.8% |
| `components/MusicPlayer.tsx` | 856 | 401 | -53.2% |
| `components/AlbumSubmissionForm.tsx` | 763 | 274 | -64.1% |
| `components/MultiSongSubmissionForm.tsx` | 630 | 258 | -59.0% |
| `components/SongSubmissionForm.tsx` | 597 | 232 | -61.1% |
| `components/EditSubmissionForm.tsx` | 583 | 309 | -47.0% |

### 3.3 Remaining large frontend hotspots
- No previously tracked monolithic FE business component remains above the Phase 3 target threshold.

## 4) Completed Work by Phase

## Phase 0 (Completed)
- Dependency audit documented.
- Vitest + React Testing Library setup added.
- Playwright smoke setup added and validated.

Artifacts:
- `docs/frontend-dependency-audit-phase0.md`

## Phase 1 (Completed)
- Replaced deprecated metadata package usage:
  - `music-metadata-browser` -> `music-metadata`
- Removed unused direct dependencies:
  - `@simplewebauthn/server`
  - `@simplewebauthn/types`
  - `nodemailer`
  - `@types/nodemailer`
- RHF render-path watch cleanup completed (`form.watch(...)` usage removed in active frontend path).

Artifacts:
- `docs/frontend-phase1-update.md`

## Phase 2 (Substantially Completed)
- Submission-domain shared modules extracted (`lib/submission/*`).
- Major decomposition completed for:
  - Create league flows (`components/league/create/*`, `lib/leagues/*`)
  - League stats (`components/league/stats/*`, `hooks/useLeagueStatsExport.ts`)
  - Round detail logic (`hooks/useRoundYouTubePlaylist.ts`, `hooks/useRoundVoting.ts`, `lib/rounds/*`)
  - Music player logic (`hooks/useSubmissionWaveform.ts`, `hooks/useAudioPlaybackSync.ts`, `hooks/useListenProgressSync.ts`, `hooks/useListeningPresence.ts`, `lib/music/*`)
- New unit coverage added for extracted utilities/hooks.

Artifacts:
- `docs/frontend-phase2-update.md`

## Phase 3 (Completed)
- `LeagueSettingsDialog` decomposed into `components/league/settings/*`.
- `RoundDetail` extracted status/progress/confirmation UI blocks into `components/round/*`.
- Duplicate warning dialog centralized for submission forms in `components/submission/PotentialDuplicateDialog.tsx`.
- `AlbumSubmissionForm` and `MultiSongSubmissionForm` decomposed into `components/submission/album/*` and `components/submission/multi/*` with extracted schemas in `lib/submission/*`.
- `SongSubmissionForm` and `EditSubmissionForm` decomposed into `components/submission/song/*` and `components/submission/edit/*` with extracted schemas in `lib/submission/*`.
- `MusicPlayer` bookmark/mutation logic extracted to `hooks/usePlayerBookmark.ts`, reducing container complexity below size target.

Artifacts:
- `docs/frontend-phase3-update.md`

## Phase 4 (Completed for Frontend Scope)
- Enabled `useUnknownInCatchVariables` in `tsconfig.json`.
- Set `allowJs: false` in `tsconfig.json`.
- Added `lib/errors.ts` and started replacing ad-hoc error message extraction with `toErrorMessage(...)` in key frontend modules.
- Added `tsconfig.frontend-strict.json` for staged `noUncheckedIndexedAccess`.
- Resolved current frontend strict-index errors in `components/*`, `hooks/*`, and `lib/*` touched surfaces.
- Upgraded TS-facing dependencies:
  - `typescript@5.9.3`
  - `zod@4.3.6`
  - `react-hook-form@7.71.1`
- Standardized remaining frontend-facing error handling call sites to `toErrorMessage(...)`.
- Remaining strict failures are isolated to Convex backend/seed modules (`convex/*`) currently pulled in via generated API typing.
- `exactOptionalPropertyTypes` and `verbatimModuleSyntax` were evaluated and deferred: enabling both currently introduces broad, non-incremental migration churn across frontend + Convex.

Artifacts:
- `docs/frontend-phase4-update.md`

## Phase 5 (Implemented)
- Replaced remaining `react-icons/fa` usage with local brand SVG components (`components/icons/BrandIcons.tsx`).
- Removed `react-icons` dependency.
- Upgraded:
  - `lucide-react@0.563.0`
  - `recharts@3.7.0`
- Added bundle analysis setup:
  - `@next/bundle-analyzer@16.1.6`
  - `ANALYZE=true` integration in `next.config.ts`
  - `npm run analyze:bundle` (`--webpack`, analyzer-compatible in Next 16)
- Added local-font strategy:
  - vendored Geist variable fonts in `app/fonts/geist/*`
  - migrated to `next/font/local` in `app/layout.tsx`
  - no Google Fonts runtime/build fetch dependency remains.
- Standardized local FE command wrappers:
  - `lint`, `typecheck`, `test:unit`, `test:e2e`, `build`, `analyze:bundle`, `check`
- Analyzer artifact generation verified:
  - local run with writable dist override: `tmp/.next-build-analyze/analyze/client.html`, `tmp/.next-build-analyze/analyze/nodejs.html`, `tmp/.next-build-analyze/analyze/edge.html`
  - default run: `.next/analyze/client.html`, `.next/analyze/nodejs.html`, `.next/analyze/edge.html`

Artifacts:
- `docs/frontend-phase5-update.md`

## Phase 6 (Completed for agreed scope)
- Added unit tests for extracted frontend modules:
  - `tests/unit/errors.test.ts`
  - `tests/unit/submission-forms.test.ts`
  - `tests/unit/create-league-form.test.ts`
  - `tests/unit/league-settings-form.test.ts`
  - `tests/unit/submission-collection.test.ts`
- Expanded smoke e2e coverage to 3 checks in `tests/e2e/smoke.spec.ts`:
  - homepage title
  - unauthenticated landing content
  - `/signin` CTA rendering
- Improved e2e stability:
  - external-server mode in `playwright.config.ts` via `PLAYWRIGHT_BASE_URL`
  - smoke/e2e scripts now target a running local app server
  - fixed server-side Convex site URL precedence for local networking

Artifacts:
- `docs/frontend-phase6-update.md`

## 5) Dependency Decision Log (Current)

Registry check date: 2026-02-08 (`npm view ... version`)

| Package | Installed | Latest | Decision | Notes |
|---|---:|---:|---|---|
| `next` | 16.1.6 | 16.1.6 | Keep | Already current. |
| `react` | 19.2.4 | 19.2.4 | Keep | Already current. |
| `typescript` | 5.9.3 | 5.9.3 | Keep | Upgraded in Phase 4. |
| `react-hook-form` | 7.71.1 | 7.71.1 | Keep | Upgraded in Phase 4. |
| `lucide-react` | 0.563.0 | 0.563.0 | Keep | Upgraded in Phase 5. |
| `recharts` | 3.7.0 | 3.7.0 | Keep (monitor) | Upgraded in Phase 5; continue chart visual checks. |
| `zod` | 4.3.6 | 4.3.6 | Keep | Upgraded in Phase 4. |
| `waveform-data` | 4.5.2 | 4.5.2 | Keep (monitor) | No forced replacement needed now. |
| `jdenticon` | 3.3.0 | 3.3.0 | Keep (evaluate replacement later) | Replace only if product requirements exceed current avatar needs. |
| `react-icons` | removed | 5.5.0 | Removed | Replaced by local brand SVG components. |
| `geist` | removed | 1.7.0 | Removed | Replaced package import usage with vendored local font assets. |

## 6) Remaining Modernization Plan

## Phase 3: Finish Structural Decomposition (Priority: High, Completed)
Goal: remove remaining monoliths and align component boundaries.

Work items:
- Completed:
  - `components/SongSubmissionForm.tsx`
  - `components/EditSubmissionForm.tsx`
  - `components/MultiSongSubmissionForm.tsx`
  - `components/AlbumSubmissionForm.tsx`
  - `components/MusicPlayer.tsx` reduced below target

Exit criteria:
- No FE business component above ~450 lines (exceptions documented).
- Shared submission behavior lives in `lib/submission/*` or dedicated hooks, not duplicated inline.

## Phase 4: TypeScript Hardening + Error Handling (Priority: High, Completed for Frontend Scope)
Goal: increase static correctness with controlled rollout.

Work items:
- Harden `tsconfig.json` incrementally:
  - `useUnknownInCatchVariables: true` (completed)
  - `allowJs: false` (completed)
  - `noUncheckedIndexedAccess: true` (completed for staged frontend scope; full-project pending Convex backend/seed cleanup)
  - `exactOptionalPropertyTypes: true` (evaluated, deferred)
  - `verbatimModuleSyntax: true` (evaluated, deferred)
- Standardize error handling:
  - Add `lib/errors.ts` with `toErrorMessage(error: unknown): string` (completed)
  - Replaced remaining frontend-facing `(err as Error).message` / `err.data?.message` patterns in active paths
- Upgrade safe TS-facing deps after each flag step:
  - `typescript` (completed)
  - `zod` (completed)
  - `react-hook-form` (completed)

Exit criteria:
- `npm run typecheck` clean with hardened flags (currently true for active global flags).
- `npx tsc --noEmit --project tsconfig.frontend-strict.json` clean for frontend scope (frontend now clean; remaining failures are backend/seed strict backlog).
- No new `any` leaks introduced by TS option changes.
- Error-to-message conversion is centralized.

## Phase 5: Dependency + Bundle Hygiene (Priority: Medium, Implemented)
Goal: reduce maintenance and bundle surface safely.

Work items:
- Icon consolidation:
  - Replace remaining `react-icons/fa` usage with local SVG components (completed).
  - Remove `react-icons` dependency (completed).
- Review bundle-sensitive dependencies in critical paths:
  - `recharts` (chart routes only) (upgraded; keep monitoring visuals)
  - `waveform-data` (player paths)
- Evaluate adding bundle visibility tooling for PR reviews (build analyzer snapshot in CI artifact).
  - Tooling wired and validated in local flows (`@next/bundle-analyzer`, `npm run analyze:bundle`).

Exit criteria:
- Single preferred icon system in app code (completed).
- Bundle change visibility available for major FE PRs (completed with analyzer report generation).

## Phase 6: Test Coverage Expansion (Priority: Medium, Completed for agreed scope)
Goal: protect critical flows before final hardening.

Work items:
- Add unit tests for remaining extracted modules/hooks.
  - Completed this iteration:
    - `lib/errors.ts`
    - `lib/submission/*-form.ts`
    - `lib/leagues/create-league-form.ts`
    - `lib/leagues/league-settings-form.ts`
    - `lib/submission/collection.ts`
- Expand Playwright beyond smoke into critical path scenarios:
  - Completed this iteration:
    - strengthened smoke coverage (homepage + signin)
    - made smoke execution stable and green
  - Deferred by product-direction choice:
    - authenticated create league flow
    - authenticated submission create/edit flow
    - authenticated vote flow
    - authenticated bookmark flow
- Keep e2e suite tiered:
  - smoke on all PRs
  - heavier scenarios nightly or pre-release

Exit criteria:
- Unit coverage includes newly extracted high-risk logic paths. (met for planned frontend modules)
- Stable smoke e2e gate is in place. (met)
- Authenticated critical-flow e2e coverage remains optional future work, intentionally deferred.

## 7) Quality Gates (Target End State)
Required for frontend-affecting PRs:
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e:smoke`
- `npx tsc --noEmit --project tsconfig.frontend-strict.json` (frontend strict gate; Convex backlog ignored intentionally)

Recommended next step after Phase 4:
- Add stricter smoke assertions and minimal coverage threshold for FE utilities.

## 8) Risks and Mitigations
- Highest regression risk:
  - upload + metadata handling
  - player queue/listen enforcement
  - voting/finalization transitions
- Mitigation:
  - keep extraction PRs small and behavior-preserving
  - land tests with each extraction
  - avoid dependency major bumps during large refactor PRs

## 9) Delivery Sequence
1. (Optional) Complete Convex strict backlog cleanup if full-project `noUncheckedIndexedAccess` convergence is required.
2. (Optional, deferred) Add authenticated Better Auth critical-flow e2e scenarios if test-auth strategy changes.
3. (Optional, deferred) Add analyzer artifact upload in external deployment automation if desired for Coolify workflows.

## 10) Reference Sources
- Next.js App Router docs: https://nextjs.org/docs/app
- Next.js Server vs Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js `optimizePackageImports`: https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
- TypeScript `exactOptionalPropertyTypes`: https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html
- TypeScript `noUncheckedIndexedAccess`: https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html
- TypeScript `useUnknownInCatchVariables`: https://www.typescriptlang.org/tsconfig/useUnknownInCatchVariables.html
- TypeScript `verbatimModuleSyntax`: https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html
- Frontend dependency audit: `docs/frontend-dependency-audit-phase0.md`
- Phase 1 execution log: `docs/frontend-phase1-update.md`
- Phase 2 execution log: `docs/frontend-phase2-update.md`
- Phase 5 execution log: `docs/frontend-phase5-update.md`
- Phase 6 execution log: `docs/frontend-phase6-update.md`
