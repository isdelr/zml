# Frontend Modernization Phase 6 Update

Date: 2026-02-08

## Completed (This Iteration)

### 1) Unit coverage expansion for extracted frontend modules
- Added `tests/unit/errors.test.ts` for `toErrorMessage(...)` normalization behavior.
- Added `tests/unit/submission-forms.test.ts` for:
  - `songSubmissionFormSchema`
  - `multiSongSubmissionFormSchema`
  - `albumSubmissionFormSchema`
  - default values and default track factory helpers
- Added `tests/unit/create-league-form.test.ts` for:
  - `createLeagueFormSchema` `superRefine` constraints
  - `createDefaultRound()` baseline structure
- Added `tests/unit/league-settings-form.test.ts` for:
  - `leagueEditSchema` validation and conditional vote-limit requirements
- Added `tests/unit/submission-collection.test.ts` for:
  - submission collection ID formatting and `crypto.randomUUID` fallback behavior

### 2) E2E smoke strengthening
- Expanded `tests/e2e/smoke.spec.ts` from 1 to 3 smoke scenarios:
  - homepage title check
  - unauthenticated landing content assertions
  - `/signin` CTA rendering

### 3) E2E reliability improvements
- Made Playwright config support external app server mode via `PLAYWRIGHT_BASE_URL`:
  - when set, Playwright no longer boots a local `next dev` web server.
- Updated e2e scripts to support external app server mode:
  - `test:e2e`
  - `test:e2e:smoke`
- Fixed server-side Convex site URL resolution for container networking:
  - prefer `CONVEX_SITE_URL` over `NEXT_PUBLIC_CONVEX_SITE_URL` in:
    - `lib/auth-server.ts`
    - `app/api/auth/[...all]/route.ts`
    - `app/api/auth/session/route.ts`
- Added container-internal auth site URL to app service:
  - `docker-compose.dev.yml` (`CONVEX_SITE_URL=http://convex-backend:3211`)

## Validation
- `npm run test:unit` passed
  - 14 files, 45 tests passed
- `npm run test:e2e:smoke` passed
  - 3/3 smoke tests passed

## Scope Decision and Deferrals
- Authenticated Better Auth e2e coverage is intentionally deferred by project direction for now.
  - deferred flows:
    - create league
    - submission create/edit
    - vote flow
    - bookmark flow
- CI artifact wiring for bundle analyzer output is also intentionally deferred (Coolify-first workflow).
