import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("applies variant styles", () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass(
      "bg-secondary",
    );
  });
});

