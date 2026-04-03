import { describe, expect, it } from "vitest";
import {
  resolveShouldMentionDiscordUsers,
  shouldMentionDiscordUsersForReminder,
} from "@/lib/discord/reminder-mentions";

describe("Discord reminder mentions", () => {
  it("suppresses mentions for passive update notifications", () => {
    expect(shouldMentionDiscordUsersForReminder("deadline_changed")).toBe(
      false,
    );
    expect(shouldMentionDiscordUsersForReminder("extension_poll_result")).toBe(
      false,
    );
    expect(shouldMentionDiscordUsersForReminder("standings_shift")).toBe(
      false,
    );
    expect(shouldMentionDiscordUsersForReminder("schedule_changed")).toBe(
      false,
    );
  });

  it("keeps mentions enabled for targeted reminder notifications", () => {
    expect(shouldMentionDiscordUsersForReminder("participation")).toBe(true);
    expect(shouldMentionDiscordUsersForReminder("deadline")).toBe(true);
    expect(shouldMentionDiscordUsersForReminder("transition")).toBe(true);
    expect(shouldMentionDiscordUsersForReminder("extension_poll")).toBe(true);
  });

  it("allows explicit suppression even for reminder kinds that usually mention", () => {
    expect(
      resolveShouldMentionDiscordUsers({
        reminderKind: "transition",
        suppressMentions: true,
      }),
    ).toBe(false);
    expect(
      resolveShouldMentionDiscordUsers({
        reminderKind: "deadline",
      }),
    ).toBe(true);
  });
});
