export type DiscordReminderKind =
  | "participation"
  | "deadline"
  | "transition"
  | "extension_poll"
  | "extension_poll_result"
  | "deadline_changed"
  | "standings_shift"
  | "schedule_changed";

export function shouldMentionDiscordUsersForReminder(
  reminderKind: DiscordReminderKind,
): boolean {
  return (
    reminderKind !== "deadline_changed" &&
    reminderKind !== "extension_poll_result" &&
    reminderKind !== "standings_shift" &&
    reminderKind !== "schedule_changed"
  );
}
