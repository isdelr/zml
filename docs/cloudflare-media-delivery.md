# Cloudflare Media Delivery

This repo now serves file-submission audio and album art from stable app paths:

- `/api/media/submissions/:submissionId/audio`
- `/api/media/submissions/:submissionId/art`

The URLs are signed with `mediaToken` and `mediaExpires` query params, so the app origin can validate access without exposing raw Backblaze B2 URLs to browsers.

## Required env

- `MEDIA_ACCESS_SECRET`
- `MEDIA_ACCESS_TTL_SECONDS`
- `MEDIA_DELIVERY_BASE_URL`

Optional cache purge support:

- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_API_TOKEN`

## Edge setup

1. Put Cloudflare in front of the media hostname from `MEDIA_DELIVERY_BASE_URL`.
2. Deploy the worker template in [docs/cloudflare-media-worker.ts](/C:/Users/isadl/Documents/Projects/zml/docs/cloudflare-media-worker.ts).
3. Set worker vars:
   - `MEDIA_ACCESS_SECRET`
   - `ORIGIN_BASE_URL`
4. Route the media hostname through the worker.

The worker validates the signed query token, fetches the app origin, and caches by the stable path instead of the rotating tokenized query string.

## App behavior

- Audio playback/download refresh calls now mint fresh stable media URLs instead of direct B2 presigned URLs.
- File-upload waveform generation happens server-side and stores the JSON waveform in Convex.
- File replacement paths schedule Cloudflare purge calls so updated media does not stay cached indefinitely.
