const BRACKETED_SEGMENTS_REGEX = /\(.*?\)|\[.*?\]/g;
const MULTI_WHITESPACE_REGEX = /\s+/g;

export function normalizeSubmissionSongTitle(songTitle: string): string {
  return songTitle
    .trim()
    .toLowerCase()
    .replace(BRACKETED_SEGMENTS_REGEX, " ")
    .replace(MULTI_WHITESPACE_REGEX, " ")
    .trim();
}

export function normalizeSubmissionArtist(artist: string): string {
  return artist
    .trim()
    .toLowerCase()
    .replace(MULTI_WHITESPACE_REGEX, " ")
    .trim();
}

export function buildSubmissionSearchText(songTitle: string, artist: string): string {
  return `${songTitle} ${artist}`.trim();
}
