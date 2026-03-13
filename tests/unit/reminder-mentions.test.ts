import { describe, expect, it } from "vitest";
import { shouldMentionDiscordUsersForReminder } from "@/lib/discord/reminder-mentions";

describe("Discord reminder mentions", () => {
  it("suppresses mentions for passive update notifications", () => {
    expect(shouldMentionDiscordUsersForReminder("deadline_changed")).toBe(
      false,
    );
    expect(shouldMentionDiscordUsersForReminder("standings_shift")).toBe(
      false,
    );
  });

  it("keeps mentions enabled for targeted reminder notifications", () => {
    expect(shouldMentionDiscordUsersForReminder("participation")).toBe(true);
    expect(shouldMentionDiscordUsersForReminder("deadline")).toBe(true);
    expect(shouldMentionDiscordUsersForReminder("transition")).toBe(true);
  });
});
