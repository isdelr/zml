type SubmissionLyricsFingerprintInput = {
  songTitle: string;
  artist: string;
  submissionType: "file" | "youtube";
  songLink?: string | null;
  songFileKey?: string | null;
  originalSongFileKey?: string | null;
};

function normalizeFingerprintPart(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function buildSubmissionLyricsFingerprint(
  input: SubmissionLyricsFingerprintInput,
): string {
  return JSON.stringify({
    artist: normalizeFingerprintPart(input.artist).toLowerCase(),
    originalSongFileKey: normalizeFingerprintPart(input.originalSongFileKey),
    songFileKey: normalizeFingerprintPart(input.songFileKey),
    songLink: normalizeFingerprintPart(input.songLink).toLowerCase(),
    songTitle: normalizeFingerprintPart(input.songTitle).toLowerCase(),
    submissionType: input.submissionType,
  });
}
