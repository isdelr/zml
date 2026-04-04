import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExpandableText } from "@/components/ui/expandable-text";

const shortText = "Short comment";
const longText =
  "Long overflow comment that should clamp in the submission list until the user chooses to expand it.";

const originalClientHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientHeight",
);
const originalScrollHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollHeight",
);

describe("ExpandableText", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return this.getAttribute("data-slot") === "expandable-text-probe"
          ? 48
          : 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        if (this.getAttribute("data-slot") !== "expandable-text-probe") {
          return 0;
        }

        return this.textContent === longText ? 96 : 48;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalClientHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "clientHeight",
        originalClientHeight,
      );
    }

    if (originalScrollHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollHeight",
        originalScrollHeight,
      );
    }
  });

  it("does not show a toggle when the text fits within the clamp", async () => {
    render(
      <ExpandableText textClassName="text-xs leading-4">{shortText}</ExpandableText>,
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /view more/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("expands and collapses overflowing text", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ExpandableText textClassName="text-xs leading-4">{longText}</ExpandableText>,
    );

    const content = container.querySelector(
      '[data-slot="expandable-text-content"]',
    );
    expect(content).not.toBeNull();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /view more/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /view more/i }).querySelector("span"),
    ).not.toBeNull();
    expect(content).toHaveClass("line-clamp-3");

    await user.click(screen.getByRole("button", { name: /view more/i }));
    expect(
      screen.getByRole("button", { name: /view less/i }),
    ).toBeInTheDocument();
    expect(content).not.toHaveClass("line-clamp-3");

    await user.click(screen.getByRole("button", { name: /view less/i }));
    expect(
      screen.getByRole("button", { name: /view more/i }),
    ).toBeInTheDocument();
    expect(content).toHaveClass("line-clamp-3");
  });
});
