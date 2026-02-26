# Frontend Modernization Phase 1 Update

Date: 2026-02-08

## Completed

- Replaced deprecated metadata package usage:
  - `music-metadata-browser` -> `music-metadata`
  - Updated imports in:
    - `components/SongSubmissionForm.tsx`
    - `components/EditSubmissionForm.tsx`
    - `components/MultiSongSubmissionForm.tsx`
    - `components/AlbumSubmissionForm.tsx`

- Removed clearly unused direct dependencies:
  - `@simplewebauthn/server`
  - `@simplewebauthn/types`
  - `nodemailer`
  - `@types/nodemailer`

- Completed RHF watch cleanup:
  - Removed remaining `form.watch(...)` usage by switching `EditSubmissionForm` to `useWatch`.

## Validation

- `npm run lint` passed
- `npm run typecheck` passed
- `npm run test:unit` passed
- `npm run test:e2e -- --project=chromium --grep "homepage renders with expected title"` passed

## Notes

- `npm ls` now shows `@simplewebauthn/server` only as a transitive dependency of `@convex-dev/better-auth`.
- `tsconfig.json` includes `.next-playwright` type paths because Playwright runs Next with `NEXT_DIST_DIR=.next-playwright`.

