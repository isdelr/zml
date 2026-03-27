import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../convex/_generated/server";
import { B2Storage } from "../../../convex/b2Storage";
import { resolveUserAvatarUrl } from "../../../convex/userAvatar";

type LeagueMemberView = {
  _id: Id<"users">;
  name: Doc<"users">["name"];
  image: Doc<"users">["image"];
  joinDate?: number;
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

  let activeMemberCount = 0;
  let spectatorCount = 0;
  for (const membership of memberships) {
    if (membership.isSpectator) {
      spectatorCount += 1;
    } else {
      activeMemberCount += 1;
    }
  }

  const members: LeagueMemberView[] = [];
  const spectators: LeagueMemberView[] = [];

  if (includeUserProfiles) {
    const membershipsForProfiles = memberships.slice(0, includeUserProfilesLimit);
    const memberViews = await Promise.all(
      membershipsForProfiles.map(async (membership) => {
        const user = await ctx.db.get("users", membership.userId);
        if (!user) {
          return null;
        }
        const image = await resolveUserAvatarUrl(storage, user);
        return {
          isSpectator: Boolean(membership.isSpectator),
          item: {
            _id: user._id,
            name: user.name,
            image: image ?? undefined,
            joinDate: membership.joinDate,
          },
        };
      }),
    );
    for (const view of memberViews) {
      if (!view) continue;
      if (view.isSpectator) {
        spectators.push(view.item);
      } else {
        members.push(view.item);
      }
    }
  } else {
    for (const membership of memberships) {
      const item: LeagueMemberView = {
        _id: membership.userId,
        name: undefined,
        image: undefined,
        joinDate: membership.joinDate,
      };

      if (membership.isSpectator) {
        spectators.push(item);
      } else {
        members.push(item);
      }
    }
  }

  const memberCount = memberships.length;

  return {
    memberCount,
    activeMemberCount,
    spectatorCount,
    members,
    spectators,
  };
}
