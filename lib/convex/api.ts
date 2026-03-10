import { api as generatedApi } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReference } from "convex/server";

type SendParticipationReminderReference = FunctionReference<
  "mutation",
  "public",
  { roundId: Id<"rounds"> },
  { notifiedCount: number; status: "submissions" | "voting" }
>;

// Frontend/server-app contract boundary for Convex function references.
export const api = generatedApi as typeof generatedApi & {
  rounds: typeof generatedApi.rounds & {
    sendParticipationReminder: SendParticipationReminderReference;
  };
};
