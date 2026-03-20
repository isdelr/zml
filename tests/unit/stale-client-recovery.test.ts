import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isChunkLoadError,
  recoverFromStaleClient,
} from "@/lib/stale-client-recovery";

describe("isChunkLoadError", () => {
  it("matches Turbopack chunk load errors", () => {
    const error = Object.assign(
      new Error("Failed to load chunk /_next/static/chunks/example.js"),
      { name: "ChunkLoadError" },
    );

    expect(isChunkLoadError(error)).toBe(true);
  });

  it("ignores unrelated runtime errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
  });
});

describe("recoverFromStaleClient", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("reloads once per error fingerprint and unregisters only app service workers", async () => {
    const reloadSpy = vi.fn();
    const unregisterAppWorker = vi.fn().mockResolvedValue(true);
    const unregisterOtherWorker = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi.fn().mockResolvedValue([
      {
        active: { scriptURL: "https://zml.app/serwist/sw.js" },
        unregister: unregisterAppWorker,
      },
      {
        active: { scriptURL: "https://zml.app/other/sw.js" },
        unregister: unregisterOtherWorker,
      },
    ]);

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations },
    });

    const error = Object.assign(
      new Error("Failed to load chunk /_next/static/chunks/example.js"),
      { name: "ChunkLoadError" },
    );

    await expect(
      recoverFromStaleClient({
        key: "chunk-load",
        error,
        unregisterServiceWorkers: true,
        reload: reloadSpy,
      }),
    ).resolves.toBe(true);

    await expect(
      recoverFromStaleClient({
        key: "chunk-load",
        error,
        unregisterServiceWorkers: true,
        reload: reloadSpy,
      }),
    ).resolves.toBe(false);

    expect(getRegistrations).toHaveBeenCalledTimes(1);
    expect(unregisterAppWorker).toHaveBeenCalledTimes(1);
    expect(unregisterOtherWorker).not.toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
