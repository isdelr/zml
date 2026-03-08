import { describe, expect, it } from "vitest";

import {
  getSubmissionFileProcessingStatus,
  hasPendingSubmissionProcessing,
  isSubmissionPlayable,
} from "@/lib/submission/file-processing";

describe("submission file processing", () => {
  it("treats legacy file submissions with a final key as ready", () => {
    expect(
      getSubmissionFileProcessingStatus({
        submissionType: "file",
        songFileKey: "submissions/audio/final.m4a",
      }),
    ).toBe("ready");
  });

  it("treats pending file submissions as not playable", () => {
    const submission = {
      submissionType: "file" as const,
      fileProcessingStatus: "queued" as const,
      songFileKey: null,
    };

    expect(hasPendingSubmissionProcessing(submission)).toBe(true);
    expect(isSubmissionPlayable(submission)).toBe(false);
  });

  it("treats youtube submissions as ready and playable from their link", () => {
    const submission = {
      submissionType: "youtube" as const,
      songLink: "https://youtube.com/watch?v=123",
    };

    expect(getSubmissionFileProcessingStatus(submission)).toBe("ready");
    expect(isSubmissionPlayable(submission)).toBe(true);
  });
});
