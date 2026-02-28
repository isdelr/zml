import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";

const CONFIRMATION_PHRASE = "FORCE_LOGOUT_ALL_USERS";
const DELETE_BATCH_SIZE = 500;
type DeleteManySessionsResult = {
  count: number;
  isDone: boolean;
  continueCursor: string | null;
};

export const forceLogoutAllUsers = internalAction({
  args: {
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== CONFIRMATION_PHRASE) {
      throw new Error(
        `Confirmation phrase mismatch. Pass confirm="${CONFIRMATION_PHRASE}".`,
      );
    }

    let deletedSessions = 0;
    let batches = 0;
    let cursor: string | null = null;

    while (true) {
      const result: DeleteManySessionsResult = await ctx.runMutation(
        components.betterAuth.adapter.deleteMany,
        {
          input: {
            model: "session",
            where: [],
          },
          paginationOpts: {
            cursor,
            numItems: DELETE_BATCH_SIZE,
          },
        },
      );

      deletedSessions += result.count;
      batches += 1;

      if (result.isDone) {
        break;
      }
      cursor = result.continueCursor;
    }

    return {
      ok: true,
      deletedSessions,
      batches,
      executedAt: Date.now(),
      note: "All Better Auth sessions were deleted. Existing Convex JWTs can remain valid until they expire.",
    };
  },
});
