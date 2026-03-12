export function getAllowedDiscordServerIdsFromEnv(
  rawValue: string | undefined | null = process.env.DISCORD_SERVER_ID,
): string[] {
  if (!rawValue) {
    return [];
  }

  return [
    ...new Set(
      rawValue
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ];
}

export function getPrimaryDiscordServerIdFromEnv(
  rawValue: string | undefined | null = process.env.DISCORD_SERVER_ID,
): string | null {
  return getAllowedDiscordServerIdsFromEnv(rawValue)[0] ?? null;
}

export function isAllowedDiscordServerId(
  serverId: string,
  rawValue: string | undefined | null = process.env.DISCORD_SERVER_ID,
): boolean {
  if (!serverId) {
    return false;
  }

  return getAllowedDiscordServerIdsFromEnv(rawValue).includes(serverId);
}
