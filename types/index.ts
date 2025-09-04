// types/index.ts
import { Doc, Id } from "@/convex/_generated/dataModel";

export type Song = {
  _id: Id<"submissions"> | string;  
  songTitle: string;
  artist: string;
  albumArtUrl: string;
  songFileUrl: string | null;
  submittedBy?: string;
  roundStatus?: Doc<"rounds">["status"];
  isBookmarked?: boolean;
   
  submissionType: "file" | "youtube";
  songLink?: string | null;
  roundTitle?: string;
  leagueName?: string;
  leagueId?: Id<"leagues">;
  comment?: string | null;
  isTrollSubmission?: boolean;
  markedAsTrollBy?: Id<"users">;
  markedAsTrollAt?: number;
};