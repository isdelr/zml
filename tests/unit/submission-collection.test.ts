import { afterEach, describe, expect, it, vi } from "vitest";

import { createSubmissionCollectionId } from "@/lib/submission/collection";

describe("createSubmissionCollectionId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds a stable prefix using round id and timestamp", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const id = createSubmissionCollectionId("round123");
    const parts = id.split("_");

    expect(parts[0]).toBe("round123");
    expect(parts[1]).toBe("1700000000000");
    expect(parts.at(-1)).toMatch(/^[a-z0-9]{12}$/i);
  });

  it("falls back to Math.random when crypto.randomUUID is unavailable", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    vi.stubGlobal("crypto", undefined);

    const id = createSubmissionCollectionId("roundX");
    const parts = id.split("_");

    expect(parts[0]).toBe("roundX");
    expect(parts[1]).toBe("1700000000000");
    expect(parts[2]).toMatch(/^[a-z0-9]{10,12}$/i);
  });
});
