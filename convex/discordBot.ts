import { v } from "convex/values";
import type { HttpRouter } from "convex/server";
import {
  httpAction,
  internalAction,
  internalQuery,
  type ActionCtx,
  type QueryCtx,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getPrimaryDiscordServerIdFromEnv,
  isAllowedDiscordServerId,
} from "../lib/discord/server-access";
import { shouldMentionDiscordUsersForReminder } from "../lib/discord/reminder-mentions";

const BOT_API_PREFIX = "/discord-bot";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

type BotRequestAuth =
  | { ok: true; requesterDiscordUserId: string }
  | { ok: false; response: Response };

type LeagueSearchResult = {
  _id: Id<"leagues">;
  name: string;
  description: string;
  inviteCode: string | null;
  isPublic: boolean;
};

type StandingSummary = {
  userId: Id<"users">;
  rank: number;
  name: string;
  totalPoints: number;
  totalWins: number;
};

type RoundSummary = {
  _id: Id<"rounds">;
  title: string;
  status: Doc<"rounds">["status"];
  submissionDeadline: number;
  votingDeadline: number;
};

const DEFAULT_PAGINATION_OPTS = {
  cursor: null,
  numItems: 256,
} as const;

type BetterAuthFindManyResult<T> = {
  page?: T[];
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function getBotApiToken() {
  return process.env.ZML_DISCORD_API_TOKEN ?? null;
}

function getReminderWebhookUrl() {
  return process.env.ZML_DISCORD_WEBHOOK_URL ?? null;
}

function getWebhookSecret() {
  return process.env.ZML_DISCORD_WEBHOOK_SECRET ?? null;
}

function getSiteUrl() {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/u, "");
}

function buildActionUrl(actionUrl: string | undefined, leagueId: Id<"leagues">, roundId: Id<"rounds">) {
  const path = actionUrl ?? `/leagues/${leagueId}/round/${roundId}`;
  if (/^https?:\/\//u.test(path)) {
    return path;
  }

  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function sanitizeSearchQuery(value: string | null) {
  return value?.trim() || undefined;
}

function sortRoundsForDiscord(rounds: Doc<"rounds">[]) {
  const getRelevantDeadline = (round: Doc<"rounds">) =>
    round.status === "submissions"
      ? round.submissionDeadline
      : round.votingDeadline;

  return [...rounds].sort((a, b) => {
    const aIsActive = a.status === "submissions" || a.status === "voting";
    const bIsActive = b.status === "submissions" || b.status === "voting";

    if (aIsActive !== bIsActive) {
      return aIsActive ? -1 : 1;
    }

    if (aIsActive && bIsActive) {
      return getRelevantDeadline(a) - getRelevantDeadline(b);
    }

    return getRelevantDeadline(b) - getRelevantDeadline(a);
  });
}

async function resolveAppUserIdFromDiscordUserId(
  ctx: Pick<ActionCtx, "runQuery">,
  discordUserId: string,
): Promise<Id<"users"> | null> {
  const discordAccount = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "providerId", value: "discord" },
      { field: "accountId", value: discordUserId },
    ],
  });

  if (!discordAccount?.userId) {
    return null;
  }

  const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: discordAccount.userId }],
  });

  if (typeof authUser?.userId !== "string" || authUser.userId.length === 0) {
    return null;
  }

  return authUser.userId as Id<"users">;
}

async function getLeagueForMember(
  ctx: Pick<QueryCtx, "db">,
  requesterUserId: Id<"users">,
  leagueId: Id<"leagues">,
) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_league_and_user", (q) =>
      q.eq("leagueId", leagueId).eq("userId", requesterUserId),
    )
    .first();
  if (!membership) {
    return null;
  }

  return await ctx.db.get("leagues", leagueId);
}

async function resolveDiscordUserIdsForAppUsers(
  ctx: Pick<ActionCtx, "runQuery">,
  appUserIds: Id<"users">[],
): Promise<string[]> {
  const uniqueAppUserIds = [...new Set(appUserIds.map((userId) => userId.toString()))];
  if (uniqueAppUserIds.length === 0) {
    return [];
  }

  const authUsersResult = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "user",
    paginationOpts: DEFAULT_PAGINATION_OPTS,
    where: [{ field: "userId", operator: "in", value: uniqueAppUserIds }],
  })) as BetterAuthFindManyResult<{ _id?: string; userId?: string }>;
  const authUsers = Array.isArray(authUsersResult.page) ? authUsersResult.page : [];

  const authUserIds = authUsers
    .map((user) => user._id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (authUserIds.length === 0) {
    return [];
  }

  const accountsResult = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "account",
    paginationOpts: DEFAULT_PAGINATION_OPTS,
    where: [
      { field: "providerId", value: "discord" },
      { field: "userId", operator: "in", value: authUserIds },
    ],
  })) as BetterAuthFindManyResult<{ accountId?: string; userId?: string }>;
  const accounts = Array.isArray(accountsResult.page) ? accountsResult.page : [];

  const appUserIdByAuthUserId = new Map<string, string>();
  for (const authUser of authUsers) {
    if (typeof authUser._id === "string" && typeof authUser.userId === "string") {
      appUserIdByAuthUserId.set(authUser._id, authUser.userId);
    }
  }

  const discordUserIds = new Map<string, string>();
  for (const account of accounts) {
    if (
      typeof account.userId !== "string" ||
      typeof account.accountId !== "string"
    ) {
      continue;
    }

    const appUserId = appUserIdByAuthUserId.get(account.userId);
    if (!appUserId) {
      continue;
    }

    discordUserIds.set(appUserId, account.accountId);
  }

  return uniqueAppUserIds
    .map((userId) => discordUserIds.get(userId))
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function signWebhookPayload(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function authenticateBotRequest(
  request: Request,
): Promise<BotRequestAuth> {
  const expectedToken = getBotApiToken();
  if (!expectedToken) {
    return {
      ok: false,
      response: jsonResponse(503, {
        error: "ZML Discord bot API is not configured.",
      }),
    };
  }

  const suppliedToken = getBearerToken(request);
  if (suppliedToken !== expectedToken) {
    return {
      ok: false,
      response: jsonResponse(401, { error: "Unauthorized." }),
    };
  }

  const serverId = request.headers.get("x-discord-server-id")?.trim() || null;
  if (!serverId || !isAllowedDiscordServerId(serverId)) {
    return {
      ok: false,
      response: jsonResponse(403, { error: "Discord server is not allowed." }),
    };
  }

  const requesterDiscordUserId =
    request.headers.get("x-discord-user-id")?.trim() || "";
  if (!requesterDiscordUserId) {
    return {
      ok: false,
      response: jsonResponse(400, { error: "Missing Discord user identity." }),
    };
  }

  return { ok: true, requesterDiscordUserId };
}

export const resolveRequesterUserId = internalQuery({
  args: { discordUserId: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    return await resolveAppUserIdFromDiscordUserId(ctx, args.discordUserId);
  },
});

export const searchLeaguesForUser = internalQuery({
  args: {
    requesterUserId: v.id("users"),
    query: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("leagues"),
      name: v.string(),
      description: v.string(),
      inviteCode: v.union(v.string(), v.null()),
      isPublic: v.boolean(),
    }),
  ),
  handler: async (ctx, args): Promise<LeagueSearchResult[]> => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", args.requesterUserId))
      .collect();
    const leagues = await Promise.all(
      memberships.map((membership) => ctx.db.get("leagues", membership.leagueId)),
    );

    const normalizedQuery = args.query?.trim().toLowerCase();
    return leagues
      .filter((league): league is NonNullable<typeof league> => league !== null)
      .filter((league) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          league._id.toString() === normalizedQuery ||
          league.inviteCode?.toLowerCase() === normalizedQuery ||
          league.name.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map((league) => ({
        _id: league._id,
        name: league.name,
        description: league.description,
        inviteCode: league.inviteCode,
        isPublic: league.isPublic,
      }));
  },
});

export const getLeagueLeaderboardForUser = internalQuery({
  args: {
    requesterUserId: v.id("users"),
    leagueId: v.id("leagues"),
    limit: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      leagueId: v.id("leagues"),
      leagueName: v.string(),
      standings: v.array(
        v.object({
          userId: v.id("users"),
          rank: v.number(),
          name: v.string(),
          totalPoints: v.number(),
          totalWins: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const league = await getLeagueForMember(ctx, args.requesterUserId, args.leagueId);
    if (!league) {
      return null;
    }

    const standingsDocs = await ctx.db
      .query("leagueStandings")
      .withIndex("by_league_and_points", (q) => q.eq("leagueId", args.leagueId))
      .order("desc")
      .collect();
    const limit = Math.max(1, Math.min(args.limit ?? 10, 20));
    const topStandings = standingsDocs.slice(0, limit);

    const users = await Promise.all(
      topStandings.map((standing) => ctx.db.get("users", standing.userId)),
    );

    const standings: StandingSummary[] = topStandings.map((standing, index) => ({
      userId: standing.userId,
      rank: index + 1,
      name: users[index]?.name ?? "Unknown User",
      totalPoints: standing.totalPoints,
      totalWins: standing.totalWins,
    }));

    return {
      leagueId: league._id,
      leagueName: league.name,
      standings,
    };
  },
});

export const getLeagueRoundsForUser = internalQuery({
  args: {
    requesterUserId: v.id("users"),
    leagueId: v.id("leagues"),
  },
  returns: v.union(
    v.null(),
    v.object({
      leagueId: v.id("leagues"),
      leagueName: v.string(),
      rounds: v.array(
        v.object({
          _id: v.id("rounds"),
          title: v.string(),
          status: v.union(
            v.literal("submissions"),
            v.literal("voting"),
            v.literal("finished"),
          ),
          submissionDeadline: v.number(),
          votingDeadline: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const league = await getLeagueForMember(ctx, args.requesterUserId, args.leagueId);
    if (!league) {
      return null;
    }

    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();

    return {
      leagueId: league._id,
      leagueName: league.name,
      rounds: sortRoundsForDiscord(rounds).map(
        (round): RoundSummary => ({
          _id: round._id,
          title: round.title,
          status: round.status,
          submissionDeadline: round.submissionDeadline,
          votingDeadline: round.votingDeadline,
        }),
      ),
    };
  },
});

export const getUpcomingRoundForUser = internalQuery({
  args: {
    requesterUserId: v.id("users"),
    leagueId: v.id("leagues"),
  },
  returns: v.union(
    v.null(),
    v.object({
      leagueId: v.id("leagues"),
      leagueName: v.string(),
      round: v.union(
        v.null(),
        v.object({
          _id: v.id("rounds"),
          title: v.string(),
          status: v.union(
            v.literal("submissions"),
            v.literal("voting"),
            v.literal("finished"),
          ),
          submissionDeadline: v.number(),
          votingDeadline: v.number(),
        }),
      ),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<{
    leagueId: Id<"leagues">;
    leagueName: string;
    round: RoundSummary | null;
  } | null> => {
    const league = await getLeagueForMember(ctx, args.requesterUserId, args.leagueId);
    if (!league) {
      return null;
    }

    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    const sortedRounds = sortRoundsForDiscord(rounds).map(
      (round): RoundSummary => ({
        _id: round._id,
        title: round.title,
        status: round.status,
        submissionDeadline: round.submissionDeadline,
        votingDeadline: round.votingDeadline,
      }),
    );

    return {
      leagueId: league._id,
      leagueName: league.name,
      round: sortedRounds[0] ?? null,
    };
  },
});

export const getLeagueMetadataForDispatch = internalQuery({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.null(), v.object({ name: v.string() })),
  handler: async (ctx, args) => {
    const league = await ctx.db.get("leagues", args.leagueId);
    return league ? { name: league.name } : null;
  },
});

export const getRoundMetadataForDispatch = internalQuery({
  args: { roundId: v.id("rounds") },
  returns: v.union(v.null(), v.object({ title: v.string() })),
  handler: async (ctx, args) => {
    const round = await ctx.db.get("rounds", args.roundId);
    return round ? { title: round.title } : null;
  },
});

export const dispatchRoundNotification = internalAction({
  args: {
    leagueId: v.id("leagues"),
    roundId: v.id("rounds"),
    roundStatus: v.union(
      v.literal("submissions"),
      v.literal("voting"),
      v.literal("finished"),
    ),
    reminderKind: v.union(
      v.literal("participation"),
      v.literal("deadline"),
      v.literal("transition"),
      v.literal("deadline_changed"),
      v.literal("standings_shift"),
    ),
    message: v.string(),
    deadlineMs: v.optional(v.number()),
    source: v.optional(v.string()),
    actionUrl: v.optional(v.string()),
    targetUserIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const webhookUrl = getReminderWebhookUrl();
    const webhookSecret = getWebhookSecret();
    const primaryServerId = getPrimaryDiscordServerIdFromEnv();
    if (!webhookUrl || !webhookSecret || !primaryServerId) {
      console.warn("[discord-bot] reminder dispatch skipped because bot webhook config is incomplete");
      return { dispatched: false, mentionedCount: 0 };
    }

    const [league, round] = await Promise.all([
      ctx.runQuery(internal.discordBot.getLeagueMetadataForDispatch, {
        leagueId: args.leagueId,
      }),
      ctx.runQuery(internal.discordBot.getRoundMetadataForDispatch, {
        roundId: args.roundId,
      }),
    ]);
    if (!league || !round) {
      return { dispatched: false, mentionedCount: 0 };
    }

    const shouldMentionUsers = shouldMentionDiscordUsersForReminder(
      args.reminderKind,
    );
    const mentionDiscordUserIds = shouldMentionUsers
      ? await resolveDiscordUserIdsForAppUsers(ctx, args.targetUserIds)
      : [];
    if (shouldMentionUsers && mentionDiscordUserIds.length === 0) {
      return { dispatched: false, mentionedCount: 0 };
    }

    const payload = {
      serverId: primaryServerId,
      leagueId: args.leagueId,
      leagueName: league.name,
      roundId: args.roundId,
      roundTitle: round.title,
      roundStatus: args.roundStatus,
      reminderKind: args.reminderKind,
      message: args.message,
      deadlineMs: args.deadlineMs ?? null,
      actionUrl: buildActionUrl(args.actionUrl, args.leagueId, args.roundId),
      source: args.source ?? null,
      mentionDiscordUserIds,
    };

    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = await signWebhookPayload(webhookSecret, timestamp, body);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-zml-timestamp": timestamp,
        "x-zml-signature": signature,
      },
      body,
    });
    if (!response.ok) {
      console.error("[discord-bot] reminder webhook failed", {
        status: response.status,
        source: args.source,
      });
      return { dispatched: false, mentionedCount: 0 };
    }

    return {
      dispatched: true,
      mentionedCount: mentionDiscordUserIds.length,
    };
  },
});

const listLeaguesHttp = httpAction(async (ctx, request) => {
  const auth = await authenticateBotRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const requesterUserId = await ctx.runQuery(internal.discordBot.resolveRequesterUserId, {
    discordUserId: auth.requesterDiscordUserId,
  });
  if (!requesterUserId) {
    return jsonResponse(403, {
      error: "Sign into ZML with this Discord account before using league commands.",
    });
  }

  const url = new URL(request.url);
  const leagues = await ctx.runQuery(internal.discordBot.searchLeaguesForUser, {
    requesterUserId,
    query: sanitizeSearchQuery(url.searchParams.get("query")),
  });

  return jsonResponse(200, { leagues });
});

const leaderboardHttp = httpAction(async (ctx, request) => {
  const auth = await authenticateBotRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const requesterUserId = await ctx.runQuery(internal.discordBot.resolveRequesterUserId, {
    discordUserId: auth.requesterDiscordUserId,
  });
  if (!requesterUserId) {
    return jsonResponse(403, {
      error: "Sign into ZML with this Discord account before using league commands.",
    });
  }

  const leagueId = new URL(request.url).searchParams.get("leagueId");
  if (!leagueId) {
    return jsonResponse(400, { error: "Missing leagueId." });
  }

  const result = await ctx.runQuery(internal.discordBot.getLeagueLeaderboardForUser, {
    requesterUserId,
    leagueId: leagueId as Id<"leagues">,
  });
  if (!result) {
    return jsonResponse(404, { error: "League not found or not accessible." });
  }

  return jsonResponse(200, result);
});

const roundsHttp = httpAction(async (ctx, request) => {
  const auth = await authenticateBotRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const requesterUserId = await ctx.runQuery(internal.discordBot.resolveRequesterUserId, {
    discordUserId: auth.requesterDiscordUserId,
  });
  if (!requesterUserId) {
    return jsonResponse(403, {
      error: "Sign into ZML with this Discord account before using league commands.",
    });
  }

  const leagueId = new URL(request.url).searchParams.get("leagueId");
  if (!leagueId) {
    return jsonResponse(400, { error: "Missing leagueId." });
  }

  const result = await ctx.runQuery(internal.discordBot.getLeagueRoundsForUser, {
    requesterUserId,
    leagueId: leagueId as Id<"leagues">,
  });
  if (!result) {
    return jsonResponse(404, { error: "League not found or not accessible." });
  }

  return jsonResponse(200, result);
});

const upcomingRoundHttp = httpAction(async (ctx, request) => {
  const auth = await authenticateBotRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const requesterUserId = await ctx.runQuery(internal.discordBot.resolveRequesterUserId, {
    discordUserId: auth.requesterDiscordUserId,
  });
  if (!requesterUserId) {
    return jsonResponse(403, {
      error: "Sign into ZML with this Discord account before using league commands.",
    });
  }

  const leagueId = new URL(request.url).searchParams.get("leagueId");
  if (!leagueId) {
    return jsonResponse(400, { error: "Missing leagueId." });
  }

  const result = await ctx.runQuery(internal.discordBot.getUpcomingRoundForUser, {
    requesterUserId,
    leagueId: leagueId as Id<"leagues">,
  });
  if (!result) {
    return jsonResponse(404, { error: "League not found or not accessible." });
  }

  return jsonResponse(200, result);
});

export const registerDiscordBotRoutes = (http: HttpRouter) => {
  http.route({
    path: `${BOT_API_PREFIX}/leagues`,
    method: "GET",
    handler: listLeaguesHttp,
  });
  http.route({
    path: `${BOT_API_PREFIX}/leaderboard`,
    method: "GET",
    handler: leaderboardHttp,
  });
  http.route({
    path: `${BOT_API_PREFIX}/rounds`,
    method: "GET",
    handler: roundsHttp,
  });
  http.route({
    path: `${BOT_API_PREFIX}/upcoming-round`,
    method: "GET",
    handler: upcomingRoundHttp,
  });
};
