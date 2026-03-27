export type DiscordReminderKind =
  | "participation"
  | "deadline"
  | "transition"
  | "deadline_changed"
  | "standings_shift"
  | "schedule_changed";

export function shouldMentionDiscordUsersForReminder(
  reminderKind: DiscordReminderKind,
): boolean {
  return (
    reminderKind !== "deadline_changed" &&
    reminderKind !== "standings_shift" &&
    reminderKind !== "schedule_changed"
  );
}
