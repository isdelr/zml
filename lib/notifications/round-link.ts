function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function getRoundNotificationPath(leagueId: string, roundId: string) {
  return `/leagues/${leagueId}/round/${roundId}`;
}

export function isNotificationLinkForRound(
  link: string,
  leagueId: string,
  roundId: string,
): boolean {
  try {
    const url = new URL(link, "http://localhost");
    return (
      normalizePathname(url.pathname) ===
      getRoundNotificationPath(leagueId, roundId)
    );
  } catch {
    return false;
  }
}
