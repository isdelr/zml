import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasRecoveryAttempted,
  isChunkLoadError,
  recoverFromStaleClient,
} from "@/lib/stale-client-recovery";

describe("stale-client-recovery", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("detects classic chunk load errors and Safari-style chunk path failures", () => {
    const classicChunkError = Object.assign(
      new Error("Failed to load chunk /_next/static/chunks/abc123.js"),
      {
        name: "ChunkLoadError",
      },
    );
    const safariChunkError = new Error(
      "Load failed while fetching /_next/static/chunks/abc123.js",
    );
    const genericSafariError = new Error("Load failed (zml.app)");

    expect(isChunkLoadError(classicChunkError)).toBe(true);
    expect(isChunkLoadError(safariChunkError)).toBe(true);
    expect(isChunkLoadError(genericSafariError)).toBe(false);
  });

  it("tracks whether a recovery attempt has already happened for an error fingerprint", async () => {
    const reload = vi.fn();
    const error = new Error(
      "Failed to load chunk /_next/static/chunks/abc123.js",
    );

    expect(
      hasRecoveryAttempted({
        key: "chunk-load",
        error,
      }),
    ).toBe(false);

    await expect(
      recoverFromStaleClient({
        key: "chunk-load",
        error,
        unregisterServiceWorkers: false,
        reload,
      }),
    ).resolves.toBe(true);

    expect(
      hasRecoveryAttempted({
        key: "chunk-load",
        error,
      }),
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    await expect(
      recoverFromStaleClient({
        key: "chunk-load",
        error,
        unregisterServiceWorkers: false,
        reload,
      }),
    ).resolves.toBe(false);
  });
});
