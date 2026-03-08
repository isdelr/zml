import { describe, expect, it } from "vitest";
import {
  createMobileTopBarScrollState,
  updateMobileTopBarScrollState,
} from "@/lib/layout/mobile-top-bar-scroll";

describe("mobile top bar scroll state", () => {
  it("hides only after sustained downward scrolling", () => {
    let state = createMobileTopBarScrollState();

    state = updateMobileTopBarScrollState(state, 20, 100);
    expect(state.hidden).toBe(false);

    state = updateMobileTopBarScrollState(state, 40, 140);
    expect(state.hidden).toBe(false);

    state = updateMobileTopBarScrollState(state, 70, 180);
    expect(state.hidden).toBe(true);
  });

  it("ignores opposite-direction bounce while the hide transition is locked", () => {
    let state = createMobileTopBarScrollState();

    state = updateMobileTopBarScrollState(state, 70, 100);
    expect(state.hidden).toBe(true);

    state = updateMobileTopBarScrollState(state, 42, 180);
    expect(state.hidden).toBe(true);

    state = updateMobileTopBarScrollState(state, 40, 360);
    expect(state.hidden).toBe(true);

    state = updateMobileTopBarScrollState(state, 12, 400);
    expect(state.hidden).toBe(false);
  });

  it("shows again after meaningful upward scrolling once hidden", () => {
    let state = createMobileTopBarScrollState();

    state = updateMobileTopBarScrollState(state, 80, 100);
    expect(state.hidden).toBe(true);

    state = updateMobileTopBarScrollState(state, 50, 360);
    expect(state.hidden).toBe(false);
  });
});
