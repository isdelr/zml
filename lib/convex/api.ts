import { api as generatedApi } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReference } from "convex/server";

type SendParticipationReminderReference = FunctionReference<
  "mutation",
  "public",
  { roundId: Id<"rounds"> },
  { notifiedCount: number; status: "submissions" | "voting" }
>;

type CreateRoundReference = FunctionReference<
  "mutation",
  "public",
  {
    leagueId: Id<"leagues">;
    title: string;
    description: string;
    submissionsPerUser: number;
    genres: string[];
    submissionMode?: "single" | "multi" | "album";
    submissionInstructions?: string;
    albumConfig?: {
      allowPartial?: boolean;
      requireReleaseYear?: boolean;
      minTracks?: number;
      maxTracks?: number;
    };
  },
  Id<"rounds">
>;

type DeleteRoundReference = FunctionReference<
  "mutation",
  "public",
  { roundId: Id<"rounds"> },
  { success: boolean }
>;

// Frontend/server-app contract boundary for Convex function references.
export const api = generatedApi as typeof generatedApi & {
  rounds: typeof generatedApi.rounds & {
    createRound: CreateRoundReference;
    deleteRound: DeleteRoundReference;
    sendParticipationReminder: SendParticipationReminderReference;
  };
};
