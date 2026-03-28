import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextResponse } from "next/server";
import { B2Storage } from "@/convex/b2Storage";
import { firstNonEmpty } from "@/lib/env";
import { toErrorMessage } from "@/lib/errors";

const storage = new B2Storage();
const convex = new ConvexHttpClient(
  firstNonEmpty(
    process.env.CONVEX_SELF_HOSTED_URL,
    process.env.NEXT_PUBLIC_CONVEX_URL,
  )!,
);
const adminConvex = convex as ConvexHttpClient & {
  setAdminAuth(token: string): void;
};

const getStorageReferenceSnapshotRef = makeFunctionReference<
  "query",
  Record<string, never>
>("mediaMaintenance:getStorageReferenceSnapshot");
const cleanupStaleStorageUploadsRef = makeFunctionReference<
  "action",
  { maxAgeMs?: number; limit?: number }
>("files:cleanupStaleStorageUploads");
const markStorageUploadsDeletedRef = makeFunctionReference<
  "mutation",
  { keys: string[] }
>("files:markStorageUploadsDeleted");

const MANAGED_PREFIXES = [
  "uploads/submissions/",
  "submissions/",
  "rounds/images/",
  "avatars/",
] as const;

type MaintenanceAction =
  | "audit-orphans"
  | "delete-orphans"
  | "cleanup-stale-uploads"
  | "reconcile";

type MaintenancePayload = {
  action?: MaintenanceAction;
  limit?: number;
  maxAgeMs?: number;
  mode?: "bucket" | "managed-prefixes";
};

function requireMaintenanceSecret(request: Request) {
  const expected = process.env.MEDIA_MAINTENANCE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "MEDIA_MAINTENANCE_SECRET is not configured." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const provided =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

async function listBucketKeys(
  mode: "bucket" | "managed-prefixes",
): Promise<string[]> {
  if (mode === "managed-prefixes") {
    const keys = new Set<string>();
    for (const prefix of MANAGED_PREFIXES) {
      let continuationToken: string | null = null;
      do {
        const response = await storage.listObjects({
          prefix,
          continuationToken: continuationToken ?? undefined,
          maxKeys: 1000,
        });
        response.keys.forEach((key) => keys.add(key));
        continuationToken = response.nextContinuationToken;
      } while (continuationToken);
    }
    return [...keys];
  }

  const keys: string[] = [];
  let continuationToken: string | null = null;
  do {
    const response = await storage.listObjects({
      continuationToken: continuationToken ?? undefined,
      maxKeys: 1000,
    });
    keys.push(...response.keys);
    continuationToken = response.nextContinuationToken;
  } while (continuationToken);
  return keys;
}

async function getReferenceSnapshot() {
  adminConvex.setAdminAuth(process.env.CONVEX_SELF_HOSTED_ADMIN_KEY!);
  return convex.query(getStorageReferenceSnapshotRef, {});
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = requireMaintenanceSecret(request);
  if (authError) {
    return authError;
  }

  let payload: MaintenancePayload;
  try {
    payload = (await request.json()) as MaintenancePayload;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid maintenance payload.",
        message: toErrorMessage(error),
      },
      { status: 400 },
    );
  }

  const action = payload.action ?? "audit-orphans";
  const mode = payload.mode ?? "bucket";
  const limit = Math.max(1, Math.min(payload.limit ?? 200, 5000));
  const maxAgeMs = payload.maxAgeMs;

  try {
    if (action === "cleanup-stale-uploads") {
      adminConvex.setAdminAuth(process.env.CONVEX_SELF_HOSTED_ADMIN_KEY!);
      const result = await convex.action(cleanupStaleStorageUploadsRef, {
        ...(typeof maxAgeMs === "number" ? { maxAgeMs } : {}),
        limit,
      });
      return NextResponse.json({ action, result });
    }

    if (action === "reconcile") {
      adminConvex.setAdminAuth(process.env.CONVEX_SELF_HOSTED_ADMIN_KEY!);
      const staleCleanup = await convex.action(cleanupStaleStorageUploadsRef, {
        ...(typeof maxAgeMs === "number" ? { maxAgeMs } : {}),
        limit,
      });

      const snapshot = await getReferenceSnapshot();
      const referencedKeys = new Set(snapshot.referencedKeys);
      const trackedActiveKeys = new Set(snapshot.trackedActiveKeys);
      const bucketKeys = await listBucketKeys(mode);
      const orphanedKeys = bucketKeys.filter(
        (key) => !referencedKeys.has(key) && !trackedActiveKeys.has(key),
      );

      return NextResponse.json({
        action,
        staleCleanup,
        summary: {
          bucketObjectCount: bucketKeys.length,
          referencedKeyCount: referencedKeys.size,
          trackedActiveKeyCount: trackedActiveKeys.size,
          orphanedKeyCount: orphanedKeys.length,
          sampleOrphanedKeys: orphanedKeys.slice(0, Math.min(50, limit)),
        },
      });
    }

    const snapshot = await getReferenceSnapshot();
    const referencedKeys = new Set(snapshot.referencedKeys);
    const trackedActiveKeys = new Set(snapshot.trackedActiveKeys);
    const bucketKeys = await listBucketKeys(mode);
    const orphanedKeys = bucketKeys.filter(
      (key) => !referencedKeys.has(key) && !trackedActiveKeys.has(key),
    );

    if (action === "audit-orphans") {
      return NextResponse.json({
        action,
        summary: {
          bucketObjectCount: bucketKeys.length,
          referencedKeyCount: referencedKeys.size,
          trackedActiveKeyCount: trackedActiveKeys.size,
          orphanedKeyCount: orphanedKeys.length,
          sampleOrphanedKeys: orphanedKeys.slice(0, Math.min(50, limit)),
        },
      });
    }

    const keysToDelete = orphanedKeys.slice(0, limit);
    let deletedCount = 0;
    for (const key of keysToDelete) {
      await storage.deleteObject(key);
      deletedCount += 1;
    }

    adminConvex.setAdminAuth(process.env.CONVEX_SELF_HOSTED_ADMIN_KEY!);
    await convex.mutation(markStorageUploadsDeletedRef, {
      keys: keysToDelete,
    });

    return NextResponse.json({
      action,
      summary: {
        bucketObjectCount: bucketKeys.length,
        referencedKeyCount: referencedKeys.size,
        trackedActiveKeyCount: trackedActiveKeys.size,
        orphanedKeyCount: orphanedKeys.length,
        deletedCount,
        deletedKeys: keysToDelete,
        remainingOrphanEstimate: Math.max(0, orphanedKeys.length - keysToDelete.length),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Media maintenance failed.",
        message: toErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
