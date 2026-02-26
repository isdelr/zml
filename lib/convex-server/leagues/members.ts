import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../convex/_generated/server";
import { B2Storage } from "../../../convex/b2Storage";
import { resolveUserAvatarUrl } from "../../../convex/userAvatar";

type LeagueMemberView = {
  _id: Id<"users">;
  name: Doc<"users">["name"];
  image: Doc<"users">["image"];
};

export type LeagueMembersSummary = {
  memberCount: number;
  activeMemberCount: number;
  spectatorCount: number;
  members: LeagueMemberView[];
  spectators: LeagueMemberView[];
};

const storage = new B2Storage();

export async function getLeagueMembersSummary(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  options?: {
    includeUserProfiles?: boolean;
    includeUserProfilesLimit?: number;
  },
): Promise<LeagueMembersSummary> {
  const includeUserProfiles = options?.includeUserProfiles ?? true;
  const includeUserProfilesLimit = Math.max(
    0,
    options?.includeUserProfilesLimit ?? Number.POSITIVE_INFINITY,
  );
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .collect();

  const membershipByUserId = new Map<string, Doc<"memberships">>();
  for (const membership of memberships) {
    membershipByUserId.set(membership.userId.toString(), membership);
  }

  const members: LeagueMemberView[] = [];
  const spectators: LeagueMemberView[] = [];

  if (includeUserProfiles) {
    const membershipIdsForProfiles = memberships
      .slice(0, includeUserProfilesLimit)
      .map((membership) => membership.userId);
    const memberDocs = await Promise.all(
      membershipIdsForProfiles.map((userId) => ctx.db.get("users", userId)),
    );

    for (const user of memberDocs) {
      if (!user) continue;
      const membership = membershipByUserId.get(user._id.toString());
      if (!membership) continue;

      const item: LeagueMemberView = {
        _id: user._id,
        name: user.name,
        image: (await resolveUserAvatarUrl(storage, user)) ?? undefined,
      };

      if (membership.isSpectator) {
        spectators.push(item);
      } else {
        members.push(item);
      }
    }
  } else {
    for (const membership of memberships) {
      const item: LeagueMemberView = {
        _id: membership.userId,
        name: undefined,
        image: undefined,
      };

      if (membership.isSpectator) {
        spectators.push(item);
      } else {
        members.push(item);
      }
    }
  }

  const activeMemberCount = memberships.filter((m) => !m.isSpectator).length;
  const spectatorCount = memberships.filter((m) => !!m.isSpectator).length;
  const memberCount = memberships.length;

  return {
    memberCount,
    activeMemberCount,
    spectatorCount,
    members,
    spectators,
  };
}
