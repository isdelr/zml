import { getAuthUserId } from "../../../convex/authCore";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

type RoundPermissionContext = {
  league: Doc<"leagues">;
  userId: Id<"users">;
  isOwner: boolean;
  isManager: boolean;
  isGlobalAdmin: boolean;
};

async function loadRoundPermissionContext(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
): Promise<RoundPermissionContext> {
  const league = await ctx.db.get("leagues", leagueId);
  if (!league) throw new Error("League not found");

  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated.");

  const user = await ctx.db.get("users", userId);
  return {
    league,
    userId,
    isOwner: league.creatorId === userId,
    isManager: (league.managers && league.managers.includes(userId)) || false,
    isGlobalAdmin: !!user?.isGlobalAdmin,
  };
}

export async function requireOwnerOrGlobalAdmin(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
) {
  const permission = await loadRoundPermissionContext(ctx, leagueId);
  if (!(permission.isOwner || permission.isGlobalAdmin)) {
    throw new Error("You do not have permission to manage this league.");
  }
  return permission;
}

export async function requireOwnerManagerOrGlobalAdmin(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
) {
  const permission = await loadRoundPermissionContext(ctx, leagueId);
  if (!(permission.isOwner || permission.isManager || permission.isGlobalAdmin)) {
    throw new Error("You do not have permission to manage this league.");
  }
  return permission;
}
