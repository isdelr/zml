import { toErrorMessage } from "@/lib/errors";

const STALE_CLIENT_RECOVERY_KEY_PREFIX = "stale-client-recovery";
const ZML_SERVICE_WORKER_PATH_PREFIX = "/serwist/";

function getErrorName(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }

  return "";
}

function getErrorStack(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "stack" in error &&
    typeof error.stack === "string"
  ) {
    return error.stack;
  }

  return "";
}

function normalizeFingerprintPart(value: string): string {
  return value.trim().toLowerCase().slice(0, 200);
}

function getRecoveryFingerprint(error: unknown, fallback: string): string {
  const name = normalizeFingerprintPart(getErrorName(error));
  const message = normalizeFingerprintPart(toErrorMessage(error, fallback));

  return [name, message].filter(Boolean).join("|") || fallback;
}

async function unregisterZmlServiceWorkers() {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof navigator.serviceWorker.getRegistrations !== "function"
  ) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations
      .filter((registration) => {
        const candidate =
          registration.active ?? registration.waiting ?? registration.installing;
        if (!candidate) return false;

        return new URL(candidate.scriptURL).pathname.startsWith(
          ZML_SERVICE_WORKER_PATH_PREFIX,
        );
      })
      .map((registration) => registration.unregister()),
  );
}

function buildRecoveryKey(key: string, error?: unknown): string {
  return `${STALE_CLIENT_RECOVERY_KEY_PREFIX}:${key}:${getRecoveryFingerprint(error, key)}`;
}

export function isChunkLoadError(error: unknown): boolean {
  const name = getErrorName(error).toLowerCase();
  const message = toErrorMessage(error, "").toLowerCase();
  const stack = getErrorStack(error).toLowerCase();
  const mentionsChunkPath =
    message.includes("/_next/static/chunks/") ||
    message.includes("/_next/static/css/") ||
    stack.includes("/_next/static/chunks/");
  const isModuleLoadFailure =
    message.includes("importing a module script failed") ||
    message.includes("failed to fetch dynamically imported module") ||
    (message.includes("load failed") && mentionsChunkPath);

  return (
    name.includes("chunkloaderror") ||
    message.includes("failed to load chunk") ||
    message.includes("loading chunk") ||
    (message.includes("/_next/static/chunks/") && message.includes(".js")) ||
    isModuleLoadFailure
  );
}

export function isConvexVersionMismatchError(error: unknown): boolean {
  const message = toErrorMessage(error, "").toLowerCase();

  return (
    message.includes("[convex fatal error]") &&
    message.includes("base version") &&
    message.includes("current version")
  );
}

export async function recoverFromStaleClient({
  key,
  error,
  unregisterServiceWorkers = false,
  reload = () => window.location.reload(),
}: {
  key: string;
  error?: unknown;
  unregisterServiceWorkers?: boolean;
  reload?: () => void;
}): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const recoveryKey = buildRecoveryKey(key, error);

  if (window.sessionStorage.getItem(recoveryKey) === "1") {
    return false;
  }

  window.sessionStorage.setItem(recoveryKey, "1");

  try {
    if (unregisterServiceWorkers) {
      await unregisterZmlServiceWorkers();
    }
  } catch (recoveryError) {
    console.error("[Recovery] Failed to unregister service workers", recoveryError);
  } finally {
    reload();
  }

  return true;
}

export function hasRecoveryAttempted({
  key,
  error,
}: {
  key: string;
  error?: unknown;
}): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(buildRecoveryKey(key, error)) === "1";
}
