import { describe, expect, it } from "vitest";

import {
  roundManagementSchema,
  createDefaultRoundManagementValues,
} from "@/lib/rounds/round-management-form";
import { MAX_SUBMISSIONS_PER_USER } from "@/lib/rounds/submission-settings";

function buildValidRoundInput() {
  return {
    ...createDefaultRoundManagementValues(),
    title: "Round One",
    description: "Round description long enough.",
  };
}

describe("roundManagementSchema", () => {
  it("accepts submissions per user up to the configured cap", () => {
    const result = roundManagementSchema.safeParse({
      ...buildValidRoundInput(),
      submissionsPerUser: MAX_SUBMISSIONS_PER_USER,
      submissionMode: "multi",
    });

    expect(result.success).toBe(true);
  });

  it("rejects submissions per user above the configured cap", () => {
    const result = roundManagementSchema.safeParse({
      ...buildValidRoundInput(),
      submissionsPerUser: MAX_SUBMISSIONS_PER_USER + 1,
      submissionMode: "multi",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("submissionsPerUser");
    }
  });

  it("rejects single-song mode with multiple songs per participant", () => {
    const result = roundManagementSchema.safeParse({
      ...buildValidRoundInput(),
      submissionsPerUser: 2,
      submissionMode: "single",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("submissionsPerUser");
    }
  });

  it("rejects multiple-song modes with one song per participant", () => {
    const result = roundManagementSchema.safeParse({
      ...buildValidRoundInput(),
      submissionsPerUser: 1,
      submissionMode: "album",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("submissionsPerUser");
    }
  });
});
