import { Doc, Id } from "@/convex/_generated/dataModel";

export type Song = {
  _id: Id<"submissions"> | string; // Allow string for mock IDs
  songTitle: string;
  artist: string;
  albumArtUrl: string;
  songFileUrl: string | null;
  submittedBy?: string;
  roundStatus?: Doc<"rounds">["status"];
  isBookmarked?: boolean;
  // --- ADDED ---
  submissionType: "file" | "spotify" | "youtube";
  songLink?: string | null;
  // --- END ADDED ---
};