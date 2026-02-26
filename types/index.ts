// types/index.ts
import { Doc, Id } from "@/convex/_generated/dataModel";

export type Song = {
  _id: Id<"submissions">;
  roundId: Id<"rounds">;
  leagueId: Id<"leagues">;
  songTitle: string;
  artist: string;
  albumArtUrl: string | null;
  songFileUrl: string | null;
  songLink: string | null;
  submissionType: "file" | "youtube";
  submittedBy?: string;
  submittedByImage?: string | null;
  userId?: Id<"users">;
  points?: number;
  isPenalized?: boolean;
  roundStatus?: Doc<"rounds">["status"];
  isBookmarked?: boolean;
  roundTitle?: string;
  leagueName?: string;
  comment?: string | null;
  isTrollSubmission?: boolean;
  markedAsTrollBy?: Id<"users">;
  markedAsTrollAt?: number;
  lyrics?: string | null;
  collectionId?: string | null;
  collectionType?: "multi" | "album" | null;
  collectionName?: string | null;
  collectionArtist?: string | null;
  collectionNotes?: string | null;
  collectionReleaseYear?: number | null;
  collectionTotalTracks?: number | null;
  trackNumber?: number | null;
};
