import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Doc } from "./_generated/dataModel";
import { B2Storage } from "./b2Storage";
import { resolveSubmissionMediaUrls } from "../lib/convex-server/submissions/media";

const storage = new B2Storage();

export const searchInLeague = query({
  args: {
    leagueId: v.id("leagues"),
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rounds: v.array(
      v.object({
        _id: v.id("rounds"),
        title: v.string(),
      }),
    ),
    songs: v.array(
      v.object({
        _id: v.id("submissions"),
        songTitle: v.string(),
        artist: v.string(),
        albumName: v.optional(v.string()),
        albumArtUrl: v.union(v.string(), v.null()),
        songFileUrl: v.union(v.string(), v.null()),
        submissionType: v.union(
          v.literal("file"),
          v.literal("youtube"),
        ),
        songLink: v.union(v.string(), v.null()),
        leagueId: v.id("leagues"),
        leagueName: v.optional(v.string()),
        roundId: v.id("rounds"),
        roundTitle: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const league = await ctx.db.get("leagues", args.leagueId);
    if (!league) {
      return { rounds: [], songs: [] };
    }

    if (!league.isPublic) {
      const membership =
        userId &&
        (await ctx.db
          .query("memberships")
          .withIndex("by_league_and_user", (q) =>
            q.eq("leagueId", league._id).eq("userId", userId),
          )
          .first());
      if (!membership) {
        return { rounds: [], songs: [] };
      }
    }

    const perCategoryLimit = Math.max(1, Math.min(args.limit ?? 5, 25));
    const roundSearchScanLimit = Math.max(
      50,
      Math.min(250, perCategoryLimit * 12),
    );
    const normalizedSearchText = args.searchText.trim();
    if (!normalizedSearchText) {
      return { rounds: [], songs: [] };
    }
    const needle = normalizedSearchText.toLowerCase();

    const allRoundsInLeague = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .order("desc")
      .take(roundSearchScanLimit);

    const matchedRounds = allRoundsInLeague
      .filter((round) => {
        const title = round.title.toLowerCase();
        const description = round.description.toLowerCase();
        return title.includes(needle) || description.includes(needle);
      })
      .slice(0, perCategoryLimit)
      .map((round) => ({ _id: round._id, title: round.title }));

    const matchedSubs = await ctx.db
      .query("submissions")
      .withSearchIndex("by_text", (q) =>
        q
          .search("searchText", normalizedSearchText)
          .eq("leagueId", args.leagueId),
      )
      .take(perCategoryLimit);

    const roundIds = [...new Set(matchedSubs.map((submission) => submission.roundId))];
    const roundDocs = await Promise.all(
      roundIds.map((roundId) => ctx.db.get("rounds", roundId)),
    );
    const roundMap = new Map<string, Doc<"rounds">>();
    roundDocs.forEach((round) => {
      if (round) {
        roundMap.set(round._id.toString(), round);
      }
    });

    const filteredSubs = matchedSubs.filter((submission) => {
      const round = roundMap.get(submission.roundId.toString());
      return !!round && (round.status === "voting" || round.status === "finished");
    });

    const songs = await Promise.all(
      filteredSubs.map(async (submission) => {
        const round = roundMap.get(submission.roundId.toString());
        const { albumArtUrl, songFileUrl } = await resolveSubmissionMediaUrls(
          storage,
          submission,
        );
        return {
          _id: submission._id,
          songTitle: submission.songTitle,
          artist: submission.artist,
          albumName: submission.albumName,
          albumArtUrl,
          songFileUrl,
          submissionType: submission.submissionType,
          songLink: submission.songLink ?? null,
          leagueId: submission.leagueId,
          leagueName: league.name,
          roundId: submission.roundId,
          roundTitle: round?.title,
        };
      }),
    );

    return { rounds: matchedRounds, songs };
  },
});
