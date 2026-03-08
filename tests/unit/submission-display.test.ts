import { describe, expect, it } from "vitest";

import {
  buildTrackMetadataText,
  formatArtistNames,
} from "@/lib/music/submission-display";

describe("submission display helpers", () => {
  it("normalizes comma-separated artist lists", () => {
    expect(formatArtistNames("Artist 1,Artist 2 ,  Artist 3")).toBe(
      "Artist 1, Artist 2, Artist 3",
    );
  });

  it("builds compact metadata text with album names", () => {
    expect(buildTrackMetadataText("Artist 1,Artist 2", "Album Title")).toBe(
      "Artist 1, Artist 2 • Album Title",
    );
  });

  it("omits empty values when building metadata text", () => {
    expect(buildTrackMetadataText("", "Album Title")).toBe("Album Title");
    expect(buildTrackMetadataText("Artist 1", "")).toBe("Artist 1");
  });
});
