import { Id } from "@/convex/_generated/dataModel";
import { WaveformComment } from "@/components/Waveform";

type CommentLike = {
  _id: Id<"comments">;
  text: string;
  authorName?: string | null;
  authorImage?: string | null;
  userId: string;
};

const TIMESTAMP_REGEX = /@(\d{1,2}:\d{2})/;

function parseTimeToSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  const minutes = parts[0];
  const seconds = parts[1];
  if (
    parts.length !== 2 ||
    minutes === undefined ||
    seconds === undefined ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds)
  ) {
    return -1;
  }
  return minutes * 60 + seconds;
}

export function extractTimestampedWaveformComments(
  comments: CommentLike[] | undefined,
): WaveformComment[] {
  if (!comments) return [];

  const result: WaveformComment[] = [];
  comments.forEach((comment) => {
    const match = comment.text.match(TIMESTAMP_REGEX);
    if (!match) return;

    const timestamp = match[1];
    if (!timestamp) return;
    const time = parseTimeToSeconds(timestamp);
    if (time < 0) return;

    result.push({
      id: comment._id,
      time,
      text: comment.text.replace(TIMESTAMP_REGEX, "").trim(),
      authorName: comment.authorName ?? "Unknown",
      authorImage: comment.authorImage ?? null,
      authorId: comment.userId,
    });
  });

  return result;
}
