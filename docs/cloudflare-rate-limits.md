# Cloudflare Rate Limiting and Edge Protection

## Scope
- Protect every public hostname through Cloudflare, not just `zml.app`.
- The required orange-cloud hostnames are:
  - the browser app hostname, such as `zml.app`
  - the public Convex hostname from `NEXT_PUBLIC_CONVEX_URL`

If the Convex hostname bypasses Cloudflare, app-wide DDoS and bandwidth protection is incomplete. Media now uses the app's same-origin `/api/media/*` routes, so protect that traffic under the main app hostname.

## Baseline Controls
- Enable Cloudflare Managed WAF on all public hostnames.
- Keep Cloudflare DDoS protection enabled on all public hostnames.
- Enable Super Bot Fight Mode only on the browser-facing app hostname.
- Leave API-heavy and websocket-heavy hostnames on managed WAF + explicit rate-limit rules instead of blanket bot challenges.

## Recommended Rate-Limit Rules

### App Hostname
- `POST /api/auth/*`
  - Action: Managed Challenge
  - Threshold: start around `20 requests / 60 seconds / IP`
  - Escalation: block repeat offenders after observing production traffic
- `POST /api/storage/upload-file`
  - Action: Block
  - Threshold: start around `60 requests / 10 minutes / IP`
- `POST /api/submissions/upload-song-file`
  - Action: Block
  - Threshold: start around `40 requests / 10 minutes / IP`
- `POST /api/submissions/generate-waveform`
  - Action: Block
  - Threshold: start around `20 requests / 5 minutes / IP`
- `POST /api/discord-bot/*`
  - Action: Block
  - Threshold: start around `120 requests / 60 seconds / IP`
- `POST /api/admin/media/maintenance`
  - Action: Block
  - Threshold: start around `10 requests / 10 minutes / IP`

### Convex Hostname
- Add a coarse flood rule for HTTP traffic.
- Exclude websocket upgrade requests so live queries and subscriptions keep working.
- Start in log-only mode, then enforce once you confirm normal app traffic fits comfortably below the threshold.

### App Media Routes
- Use a separate high-threshold rule for `/api/media/*` download and range-request traffic.
- Keep thresholds much higher than API routes so normal streaming and seeking are not penalized.

## Rollout
1. Turn on rules in log/simulate mode first.
2. Validate sign-in, page navigation, uploads, playback, and Convex live updates in staging.
3. Promote to block/challenge mode after reviewing Cloudflare analytics for false positives.
