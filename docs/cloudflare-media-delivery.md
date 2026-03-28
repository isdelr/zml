# Cloudflare Media Delivery

This repo now serves file-submission audio and album art from stable app paths:

- `/api/media/submissions/:submissionId/audio`
- `/api/media/submissions/:submissionId/audio/download`
- `/api/media/submissions/:submissionId/art`
- `/api/media/rounds/:roundId/image`
- `/api/media/users/:userId/avatar`

The URLs are signed with `mediaToken` and `mediaExpires` query params, so the app origin can validate access without exposing raw Backblaze B2 URLs to browsers.

## Required env

- `NEXT_PUBLIC_MEDIA_DELIVERY_BASE_URL`
- `MEDIA_ACCESS_SECRET`
- `MEDIA_ACCESS_TTL_SECONDS`
- `MEDIA_DELIVERY_BASE_URL`
- `MEDIA_ORIGIN_BASE_URL`

Optional cache purge support:

- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_API_TOKEN`

Optional maintenance endpoint:

- `MEDIA_MAINTENANCE_SECRET`

## Edge setup

1. Put Cloudflare in front of the media hostname from `MEDIA_DELIVERY_BASE_URL`.
2. Deploy the Wrangler worker in [cloudflare/media-worker/src/index.ts](/C:/Users/isadl/Documents/Projects/zml/cloudflare/media-worker/src/index.ts) with [wrangler.toml](/C:/Users/isadl/Documents/Projects/zml/cloudflare/media-worker/wrangler.toml).
3. Set worker vars:
   - `MEDIA_ACCESS_SECRET`
   - `ORIGIN_BASE_URL`
4. Add a Cache Rule on the app origin hostname for `/api/media/*` that:
   - makes requests eligible for cache
   - ignores the query string
   - optionally sorts query strings for consistency
5. Route the media hostname through the worker.

The worker validates the signed query token, then fetches the app origin. Cloudflare caches the origin subrequest under the origin hostname, so the cache rule on `zml.app` should ignore the rotating auth query params. Downloads now use a dedicated `/audio/download` path, so ignoring the query string does not mix download responses with inline playback/image responses.

## Coolify note

If your Next.js image is built by Coolify, set `NEXT_PUBLIC_MEDIA_DELIVERY_BASE_URL` and `MEDIA_DELIVERY_BASE_URL` as build-time variables as well as runtime variables. `next.config.ts` needs the media hostname during the build so `next/image` can allow it.

## App behavior

- Audio playback refresh calls now mint fresh stable media URLs instead of direct B2 presigned URLs, and downloads use the dedicated `/audio/download` path on the same tokenized URL flow.
- Cached avatars and round images now also use the same media hostname flow instead of direct B2 URLs.
- File-upload waveform generation happens server-side and stores the JSON waveform in Convex.
- File replacement paths schedule Cloudflare purge calls against the origin URLs so updated media does not stay cached indefinitely.
- New uploads are tracked in Convex and stale unclaimed uploads are cleaned automatically, reducing future orphaned media.
- Existing bucket objects can be reconciled with the runbook in [media-maintenance-runbook.md](/C:/Users/isadl/Documents/Projects/zml/docs/media-maintenance-runbook.md).
