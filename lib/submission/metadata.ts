import { parseBlob } from "music-metadata";
import { formatArtistNames } from "@/lib/music/submission-display";

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

  const artistList =
    metadata.common.artists?.length
      ? metadata.common.artists
      : metadata.common.artist
        ? [metadata.common.artist]
        : [];
  const artist = formatArtistNames(artistList.join(", "));
  const albumArtist = formatArtistNames(metadata.common.albumartist);

  return {
    durationSeconds: metadata.format.duration
      ? Math.floor(metadata.format.duration)
      : undefined,
    title: metadata.common.title || undefined,
    artist: artist || undefined,
    album: metadata.common.album || undefined,
    albumArtist: albumArtist || undefined,
    year: metadata.common.year || undefined,
    coverArtFile,
    coverArtTooLarge,
  };
}
