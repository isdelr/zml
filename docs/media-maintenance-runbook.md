# Media Maintenance Runbook

This app now tracks new uploads in Convex, cleans up stale unclaimed uploads automatically, and exposes a secret-protected maintenance endpoint for reconciling existing bucket contents.

## What changed

- New user uploads are reserved in `storageUploads` before bytes hit B2.
- Completed uploads are marked as uploaded after `syncMetadata`.
- Submission and round mutations claim those uploaded keys before saving them in the database.
- Replaced/deleted media marks tracked uploads as deleted.
- A Convex cron runs `files.cleanupStaleStorageUploads` every 6 hours.

## Required env

- `MEDIA_MAINTENANCE_SECRET`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`

## Maintenance endpoint

- Route: `/api/admin/media/maintenance`
- Auth: `Authorization: Bearer <MEDIA_MAINTENANCE_SECRET>`

## Dry-run orphan audit

Bucket-wide:

```bash
curl -X POST "https://zml.app/api/admin/media/maintenance" \
  -H "Authorization: Bearer <MEDIA_MAINTENANCE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"action":"audit-orphans","mode":"bucket","limit":200}'
```

Managed prefixes only:

```bash
curl -X POST "https://zml.app/api/admin/media/maintenance" \
  -H "Authorization: Bearer <MEDIA_MAINTENANCE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"action":"audit-orphans","mode":"managed-prefixes","limit":200}'
```

## Cleanup stale unclaimed uploads

```bash
curl -X POST "https://zml.app/api/admin/media/maintenance" \
  -H "Authorization: Bearer <MEDIA_MAINTENANCE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"action":"cleanup-stale-uploads","limit":200,"maxAgeMs":86400000}'
```

## Delete orphaned media

Start with a dry run first. Then delete in batches:

```bash
curl -X POST "https://zml.app/api/admin/media/maintenance" \
  -H "Authorization: Bearer <MEDIA_MAINTENANCE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"action":"delete-orphans","mode":"bucket","limit":200}'
```

## Safe migration order

1. Deploy the new app and Convex functions.
2. Verify new playback and image URLs are using the app's `/api/media/...` routes.
3. Run `cleanup-stale-uploads`.
4. Run `audit-orphans` and inspect the sample keys.
5. Run `delete-orphans` in small batches until `orphanedKeyCount` reaches zero.
