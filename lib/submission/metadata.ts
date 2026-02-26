import { parseBlob } from "music-metadata";

export type ParsedAudioFileMetadata = {
  durationSeconds?: number;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: number;
  coverArtFile?: File;
  coverArtTooLarge: boolean;
};

type ParseOptions = {
  maxCoverArtSizeBytes?: number;
};

export async function parseAudioFileMetadata(
  file: File,
  options?: ParseOptions,
): Promise<ParsedAudioFileMetadata> {
  const metadata = await parseBlob(file);
  const picture = metadata.common.picture?.[0];

  let coverArtFile: File | undefined;
  let coverArtTooLarge = false;

  if (picture?.data) {
    const format = picture.format || "image/jpeg";
    const ext = format.split("/")?.[1] || "jpg";
    const candidate = new File([new Uint8Array(picture.data)], `cover.${ext}`, {
      type: format,
    });

    if (
      options?.maxCoverArtSizeBytes &&
      candidate.size > options.maxCoverArtSizeBytes
    ) {
      coverArtTooLarge = true;
    } else {
      coverArtFile = candidate;
    }
  }

  return {
    durationSeconds: metadata.format.duration
      ? Math.round(metadata.format.duration)
      : undefined,
    title: metadata.common.title || undefined,
    artist: metadata.common.artist || undefined,
    album: metadata.common.album || undefined,
    albumArtist: metadata.common.albumartist || undefined,
    year: metadata.common.year || undefined,
    coverArtFile,
    coverArtTooLarge,
  };
}

