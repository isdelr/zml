const MULTI_WHITESPACE_REGEX = /\s+/g;

export function formatArtistNames(artist?: string | null): string {
  if (!artist) {
    return "";
  }

  return artist
    .split(",")
    .map((name) => name.trim().replace(MULTI_WHITESPACE_REGEX, " "))
    .filter(Boolean)
    .join(", ");
}

export function buildTrackMetadataText(
  artist?: string | null,
  albumName?: string | null,
  year?: number | null,
): string {
  const formattedYear =
    typeof year === "number" && Number.isFinite(year) && year > 0
      ? String(Math.trunc(year))
      : "";

  const parts = [formatArtistNames(artist), albumName?.trim(), formattedYear]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  return parts.join(" • ");
}
