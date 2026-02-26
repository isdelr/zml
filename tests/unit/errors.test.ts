import { describe, expect, it } from "vitest";

import { toErrorMessage } from "@/lib/errors";

describe("toErrorMessage", () => {
  it("returns a standard Error message", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("supports generic message-shaped objects", () => {
    expect(toErrorMessage({ message: "request failed" })).toBe("request failed");
  });

  it("supports nested data.message objects", () => {
    expect(toErrorMessage({ data: { message: "bad request" } })).toBe(
      "bad request",
    );
  });

  it("returns non-empty strings directly", () => {
    expect(toErrorMessage("plain string error")).toBe("plain string error");
  });

  it("falls back for empty or unknown inputs", () => {
    expect(toErrorMessage("   ")).toBe("An unknown error occurred.");
    expect(toErrorMessage(null, "fallback")).toBe("fallback");
  });
});
