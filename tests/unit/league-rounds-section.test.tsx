import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { LeagueRoundsSection } from "@/components/league/create/LeagueRoundsSection";
import { Form } from "@/components/ui/form";
import {
  createDefaultRound,
  defaultCreateLeagueFormValues,
  type CreateLeagueFormInput,
  type CreateLeagueFormValues,
} from "@/lib/leagues/create-league-form";

function RoundsHarness() {
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const form = useForm<CreateLeagueFormInput, unknown, CreateLeagueFormValues>({
    defaultValues: {
      ...defaultCreateLeagueFormValues,
      rounds: [createDefaultRound()],
    },
  });

  return (
    <Form {...form}>
      <LeagueRoundsSection
        form={form}
        previews={previews}
        setPreviews={setPreviews}
      />
    </Form>
  );
}

describe("LeagueRoundsSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("collapses a round into a summary with title, description, and delete", async () => {
    const user = userEvent.setup();
    render(<RoundsHarness />);

    fireEvent.change(screen.getByLabelText("Round Title"), {
      target: { value: "Guilty Pleasures" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Songs that feel illegal to enjoy." },
    });

    const roundToggle = screen.getByRole("button", {
      name: /Round 1 - Guilty Pleasures/i,
    });
    await user.click(roundToggle);

    expect(roundToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Round Title")).not.toBeInTheDocument();
    expect(screen.getByText("Guilty Pleasures")).toBeInTheDocument();
    expect(
      screen.getByText("Songs that feel illegal to enjoy."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete round 1" }),
    ).toBeInTheDocument();
  });

  it("expands only the newly added round", async () => {
    const user = userEvent.setup();
    render(<RoundsHarness />);

    await user.click(screen.getByRole("button", { name: "Add Round" }));

    const firstToggle = screen.getByRole("button", {
      name: /Round 1 - Untitled round/i,
    });
    const secondToggle = screen.getByRole("button", {
      name: /Round 2 - Untitled round/i,
    });

    expect(firstToggle).toHaveAttribute("aria-expanded", "false");
    expect(secondToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByLabelText("Round Title")).toHaveLength(1);

    await user.click(firstToggle);

    expect(firstToggle).toHaveAttribute("aria-expanded", "true");
    expect(secondToggle).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps song count and submission mode in sync", async () => {
    const user = userEvent.setup();
    render(<RoundsHarness />);

    const songsInput = screen.getByLabelText("Songs per Participant");
    await user.clear(songsInput);
    await user.type(songsInput, "2");

    expect(
      screen.getByRole("button", { name: /Multiple songs/i }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /Single song/i }));

    expect(songsInput).toHaveValue(1);
    expect(screen.getByRole("button", { name: /Single song/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
