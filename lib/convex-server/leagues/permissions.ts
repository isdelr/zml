import { getAuthUserId } from "../../../convex/authCore";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Id } from "../../../convex/_generated/dataModel";

export const hoursToMs = (hours: number) => hours * 60 * 60 * 1000;

export const generateInviteCode = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export const checkLeagueOwnership = async (
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Authentication required.");
  const league = await ctx.db.get("leagues", leagueId);
  if (!league) throw new Error("League not found.");
  if (league.creatorId !== userId) {
    throw new Error("You are not the owner of this league.");
  }
  return league;
};

const hasLeagueManagementPermission = async (
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;

  const user = await ctx.db.get("users", userId);
  if (user?.isGlobalAdmin) return true;

  const league = await ctx.db.get("leagues", leagueId);
  if (!league) return false;
  if (league.creatorId === userId) return true;
  if (league.managers && league.managers.includes(userId)) return true;

  return false;
};

export const checkLeagueManagementPermission = async (
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
) => {
  const hasPermission = await hasLeagueManagementPermission(ctx, leagueId);
  if (!hasPermission) {
    throw new Error("You do not have permission to manage this league.");
  }
  const league = await ctx.db.get("leagues", leagueId);
  if (!league) throw new Error("League not found.");
  return league;
};
