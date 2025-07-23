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
   
  submissionType: "file" | "spotify" | "youtube";
  songLink?: string | null;
   
};