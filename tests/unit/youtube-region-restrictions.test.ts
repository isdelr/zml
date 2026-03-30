import { describe, expect, it } from "vitest";

import {
  resolveBlockedYouTubeRegions,
  type YouTubeSupportedRegion,
} from "@/lib/convex-server/submissions/youtube";

const supportedRegions: YouTubeSupportedRegion[] = [
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "US", name: "United States" },
];

describe("YouTube region restrictions", () => {
  it("returns blocked regions directly when YouTube provides a blocked list", () => {
    expect(
      resolveBlockedYouTubeRegions(
        {
          blocked: ["de", "US", "DE"],
        },
        supportedRegions,
      ),
    ).toEqual([
      { code: "DE", name: "Germany" },
      { code: "US", name: "United States" },
    ]);
  });

  it("derives blocked regions from an allowed list", () => {
    expect(
      resolveBlockedYouTubeRegions(
        {
          allowed: ["US", "CA"],
        },
        supportedRegions,
      ),
    ).toEqual([
      { code: "BR", name: "Brazil" },
      { code: "DE", name: "Germany" },
    ]);
  });

  it("treats an empty allowed list as blocked everywhere YouTube supports", () => {
    expect(
      resolveBlockedYouTubeRegions(
        {
          allowed: [],
        },
        supportedRegions,
      ),
    ).toEqual(supportedRegions);
  });

  it("returns no warning when the blocked list is empty", () => {
    expect(
      resolveBlockedYouTubeRegions(
        {
          blocked: [],
        },
        supportedRegions,
      ),
    ).toEqual([]);
  });
});
