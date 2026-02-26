# Frontend Dependency Audit (Phase 0)

Date: 2026-02-08

## Method
- Static usage scan against `app`, `components`, `hooks`, `lib`, `scripts`, `convex`, `tests`.
- `npm ls` spot-checks for direct vs transitive overlap.
- Reference checks against official package/docs pages for deprecation and framework guidance.

Commands used:
- `rg` usage scans for dependency import strings
- `npm ls @simplewebauthn/server @simplewebauthn/types nodemailer --depth=2`
- `npm install` (to refresh lockfile and install test tooling)

## Summary
- No immediate broken or blocked frontend package found.
- One runtime package is deprecated and should be replaced in Phase 1:
  - `music-metadata-browser`
- Several direct dev dependencies appear unused in this repository code and should be validated for removal:
  - `@simplewebauthn/server`
  - `@simplewebauthn/types`
  - `nodemailer`
  - `@types/nodemailer`
- Dual icon libraries are used (`lucide-react` and `react-icons`); consolidation is recommended.

## Findings

### 1) Deprecated runtime package
- `music-metadata-browser` appears in 4 frontend files and is marked deprecated on npm.
- Action: replace with `@music-metadata/browser` in Phase 1.

### 2) Unused direct dependency candidates
- Based on repo scan, no in-repo imports/usages found for:
  - `@simplewebauthn/server`
  - `@simplewebauthn/types`
  - `nodemailer`
  - `@types/nodemailer`
- `npm ls` confirms `@simplewebauthn/server` is already present transitively via `@convex-dev/better-auth`.
- Action: remove direct installs in a dedicated PR after a full runtime test pass.

### 3) Library overlap
- `lucide-react` is heavily used.
- `react-icons` is used in a smaller set of files (mostly Font Awesome icons).
- Action: standardize on a single icon approach where practical to reduce bundle and maintenance surface.

### 4) Tooling state after Phase 0
- Added and validated:
  - Vitest + React Testing Library unit test setup
  - Playwright e2e smoke setup
- Installed Playwright Chromium locally to validate smoke execution.

## Current Risk Notes
- `npm install` reports known vulnerabilities in the full graph (23 total reported in this environment).
- No forced upgrades were applied in Phase 0; handle in Phase 1+ with targeted upgrades to avoid regression risk.

## Sources
- Next.js Server/Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js Vitest guide: https://nextjs.org/docs/app/guides/testing/vitest
- Next.js Playwright guide: https://nextjs.org/docs/app/guides/testing/playwright
- Deprecated package notice (`music-metadata-browser`): https://www.npmjs.com/package/music-metadata-browser

