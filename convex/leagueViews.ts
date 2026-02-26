// convex/leagueViews.ts
// Storage-dependent league queries, separated from leagues.ts to avoid loading
// the heavy AWS SDK on cold start for every league query.
import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";
import { getAuthUserId } from "./authCore";
import { Doc, Id } from "./_generated/dataModel";
import { B2Storage } from "./b2Storage";
import { resolveSubmissionMediaUrls } from "../lib/convex-server/submissions/media";
import { resolveUserAvatarUrl } from "./userAvatar";

const storage = new B2Storage();

export const getStatsData = internalQuery({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, args) => {
    const finishedRounds = await ctx.db
      .query("rounds")
      .withIndex("by_league_and_status", (q) =>
        q.eq("leagueId", args.leagueId).eq("status", "finished"),
      )
      .collect();
    if (finishedRounds.length === 0) return null;

    const roundIds = finishedRounds.map((r) => r._id);

    const [resultRowsByRound, voteRowsByRound, memberships, standings] = await Promise.all([
      Promise.all(
        roundIds.map((roundId) =>
          ctx.db
            .query("roundResults")
            .withIndex("by_round", (q) => q.eq("roundId", roundId))
            .collect(),
        ),
      ),
      Promise.all(
        roundIds.map((roundId) =>
          ctx.db
            .query("votes")
            .withIndex("by_round_and_user", (q) => q.eq("roundId", roundId))
            .collect(),
        ),
      ),
      ctx.db
        .query("memberships")
        .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
        .collect(),
      ctx.db
        .query("leagueStandings")
        .withIndex("by_league_and_user", (q) => q.eq("leagueId", args.leagueId))
        .collect(),
    ]);

    const results = resultRowsByRound.flat();
    const votes = voteRowsByRound.flat();

    const memberIds = [...new Set(memberships.map((membership) => membership.userId))];
    const memberDocs = (
      await Promise.all(memberIds.map((id) => ctx.db.get("users", id)))
    ).filter((member): member is Doc<"users"> => member !== null);

    const memberEntries = await Promise.all(
      memberDocs.map(async (member) => {
        const resolvedImage = await resolveUserAvatarUrl(storage, member);
        return [
          member._id.toString(),
          { name: member.name, image: resolvedImage ?? undefined },
        ] as const;
      }),
    );
    const memberMap = new Map(memberEntries);

    // Existing user awards
    const mostWins = [...standings].sort((a, b) => b.totalWins - a.totalWins);
    const overlord =
      mostWins.length > 0
        ? {
          userId: mostWins[0].userId.toString(),
          count: mostWins[0].totalWins,
        }
        : null;

    // Build helper maps for submissions and rounds to avoid reloading heavy documents
    const submissionSubmitterMap = new Map<string, Id<"users">>();
    const submissionIdMap = new Map<string, Id<"submissions">>();
    const resultsByRound = new Map<string, Doc<"roundResults">[]>();
    for (const result of results) {
      const submissionKey = result.submissionId.toString();
      submissionSubmitterMap.set(submissionKey, result.userId);
      submissionIdMap.set(submissionKey, result.submissionId);

      const roundKey = result.roundId.toString();
      if (!resultsByRound.has(roundKey)) resultsByRound.set(roundKey, []);
      resultsByRound.get(roundKey)!.push(result);
    }

    const submissionCache = new Map<string, Doc<"submissions"> | null>();
    const loadSubmission = async (submissionId: Id<"submissions">) => {
      const key = submissionId.toString();
      if (submissionCache.has(key)) {
        return submissionCache.get(key)!;
      }
      const submission = await ctx.db.get("submissions", submissionId);
      submissionCache.set(key, submission ?? null);
      return submission ?? null;
    };

    const submissionMediaCache = new Map<
      string,
      { albumArtUrl: string | null; songFileUrl: string | null }
    >();
    const loadSubmissionMedia = async (submission: Doc<"submissions">) => {
      const key = submission._id.toString();
      if (submissionMediaCache.has(key)) {
        return submissionMediaCache.get(key)!;
      }
      const media = await resolveSubmissionMediaUrls(storage, submission);
      submissionMediaCache.set(key, media);
      return media;
    };

    const roundImageUrlCache = new Map<string, string | null>();
    const loadRoundImageUrl = async (round: Doc<"rounds">) => {
      const key = round._id.toString();
      if (roundImageUrlCache.has(key)) {
        return roundImageUrlCache.get(key)!;
      }
      const imageUrl = round.imageKey ? await storage.getUrl(round.imageKey) : null;
      roundImageUrlCache.set(key, imageUrl);
      return imageUrl;
    };

    const userUpvotes = new Map<string, number>();
    const userDownvotes = new Map<string, number>();
    const userDownvotesCast = new Map<string, number>();
    const posBySubmission = new Map<string, number>();
    const negBySubmission = new Map<string, number>();

    votes.forEach((v) => {
      const submitterId = submissionSubmitterMap.get(v.submissionId.toString());
      if (submitterId) {
        if (v.vote > 0)
          userUpvotes.set(
            submitterId.toString(),
            (userUpvotes.get(submitterId.toString()) ?? 0) + v.vote,
          );
        if (v.vote < 0)
          userDownvotes.set(
            submitterId.toString(),
            (userDownvotes.get(submitterId.toString()) ?? 0) +
            Math.abs(v.vote),
          );
      }

      // downvotes cast by user
      if (v.vote < 0) {
        userDownvotesCast.set(
          v.userId.toString(),
          (userDownvotesCast.get(v.userId.toString()) ?? 0) +
          Math.abs(v.vote),
        );
      }

      // Totals by submission
      if (v.vote > 0)
        posBySubmission.set(
          v.submissionId.toString(),
          (posBySubmission.get(v.submissionId.toString()) ?? 0) + v.vote,
        );
      if (v.vote < 0)
        negBySubmission.set(
          v.submissionId.toString(),
          (negBySubmission.get(v.submissionId.toString()) ?? 0) +
          Math.abs(v.vote),
        );
    });

    const mostUpvotesArr = [...userUpvotes.entries()].sort((a, b) => b[1] - a[1]);
    const peopleChampion =
      mostUpvotesArr.length > 0
        ? { userId: mostUpvotesArr[0][0], count: mostUpvotesArr[0][1] }
        : null;

    const mostDownvotes = [...userDownvotes.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const mostControversial =
      mostDownvotes.length > 0
        ? { userId: mostDownvotes[0][0], count: mostDownvotes[0][1] }
        : null;

    const userVoteCount = new Map<string, number>();
    votes.forEach((v) =>
      userVoteCount.set(
        v.userId.toString(),
        (userVoteCount.get(v.userId.toString()) ?? 0) + Math.abs(v.vote),
      ),
    );

    const mostVotesCast = [...userVoteCount.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const prolificVoter =
      mostVotesCast.length > 0
        ? { userId: mostVotesCast[0][0], count: mostVotesCast[0][1] }
        : null;

    // Highest scoring submission (existing topResult)
    const topResult = results.reduce<Doc<"roundResults"> | null>((best, cur) => {
      if (!best) return cur;
      if (cur.points > best.points) return cur;
      return best;
    }, null);

    // Genre breakdown (existing)
    const genreCounts: Record<string, number> = {};
    const roundsMap = new Map(finishedRounds.map((r) => [r._id.toString(), r]));
    results.forEach((r) => {
      const round = roundsMap.get(r.roundId.toString());
      if (!round) return;
      round.genres.forEach(
        (g) => (genreCounts[g] = (genreCounts[g] ?? 0) + 1),
      );
    });

    const genreBreakdown = Object.entries(genreCounts).map(([name, value]) => ({
      name,
      value,
    }));

    // Helpers to format awards
    const formatUserStat = (stat: { userId: string; count: number } | null) => {
      if (!stat) return null;
      const u = memberMap.get(stat.userId);
      if (!u) return null;
      return { ...u, count: stat.count };
    };

    async function formatSongAwardFromSubmissionId(
      subId: Id<"submissions">,
      count: number,
    ) {
      const submission = await loadSubmission(subId);
      if (!submission) return null;
      const { albumArtUrl } = await loadSubmissionMedia(submission);
      const submitter = memberMap.get(submission.userId.toString());
      return {
        songTitle: submission.songTitle,
        artist: submission.artist,
        albumArtUrl,
        submittedBy: submitter?.name ?? "Unknown",
        count,
      };
    }

    // Song-level awards
    const mostUpvotedSongEntry = [...posBySubmission.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const mostDownvotedSongEntry = [...negBySubmission.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];

    // Fan favorite: most bookmarks per submission
    const uniqueSubmissionIds = [...submissionIdMap.values()];
    const bookmarkCountsBySubmission = await Promise.all(
      uniqueSubmissionIds.map(async (submissionId) => {
        const count = (
          await ctx.db
            .query("bookmarks")
            .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
            .collect()
        ).length;
        return { subId: submissionId, count };
      }),
    );
    let favorite: { subId: Id<"submissions">; count: number } | null = null;
    for (const candidate of bookmarkCountsBySubmission) {
      if (!favorite || candidate.count > favorite.count) {
        favorite = candidate;
      }
    }

    // Attendance star: most rounds submitted
    const allRoundsInLeague = await ctx.db
      .query("rounds")
      .withIndex("by_league", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    const totalRounds = allRoundsInLeague.length;

    const submittedRoundsByUser = new Map<string, Set<string>>();
    results.forEach((r) => {
      const key = r.userId.toString();
      if (!submittedRoundsByUser.has(key))
        submittedRoundsByUser.set(key, new Set());
      submittedRoundsByUser.get(key)!.add(r.roundId.toString());
    });
    const attArr = [...submittedRoundsByUser.entries()].map(([uid, set]) => ({
      uid,
      count: set.size,
    }));
    attArr.sort((a, b) => b.count - a.count);
    const attendanceStar = attArr.length
      ? { userId: attArr[0].uid, count: attArr[0].count, totalRounds }
      : null;

    // Golden ears & consistency king from results per user
    const resultsByUser = new Map<string, number[]>();
    results.forEach((r) => {
      const key = r.userId.toString();
      if (!resultsByUser.has(key)) resultsByUser.set(key, []);
      resultsByUser.get(key)!.push(r.points);
    });
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const stdev = (arr: number[]) => {
      const m = avg(arr);
      return Math.sqrt(
        arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length,
      );
    };

    const perUserAverages: { uid: string; average: number; rounds: number }[] =
      [];
    const perUserStdevs: {
      uid: string;
      dev: number;
      average: number;
      rounds: number;
    }[] = [];

    for (const [uid, arr] of resultsByUser.entries()) {
      if (arr.length === 0) continue;
      const average = avg(arr);
      const dev = arr.length >= 3 ? stdev(arr) : Number.POSITIVE_INFINITY;
      perUserAverages.push({ uid, average, rounds: arr.length });
      perUserStdevs.push({ uid, dev, average, rounds: arr.length });
    }

    perUserAverages.sort((a, b) => b.average - a.average);
    perUserStdevs.sort((a, b) => a.dev - b.dev);

    const golden = perUserAverages.length ? perUserAverages[0] : null;
    const consist =
      perUserStdevs[0]?.dev !== Number.POSITIVE_INFINITY
        ? perUserStdevs[0]
        : null;

    // Biggest downvoter
    const downvoter =
      [...userDownvotesCast.entries()].sort((a, b) => b[1] - a[1])[0] || null;

    // Round awards: worst (top-2 upvote share), closest/blowout (points diff)
    function roundUpvoteStats(roundId: Id<"rounds">) {
      const subs = (resultsByRound.get(roundId.toString()) ?? []).map((r) =>
        r.submissionId.toString(),
      );
      const pos = subs.map((sid) => posBySubmission.get(sid) ?? 0);
      const total = pos.reduce((a, b) => a + b, 0);
      const top2 = [...pos]
        .sort((a, b) => b - a)
        .slice(0, 2)
        .reduce((a, b) => a + b, 0);
      const share = total > 0 ? top2 / total : 0;
      return {
        totalUpvotes: total,
        top2Share: share,
        submissions: subs.length,
      };
    }

    function roundPointsDiff(roundId: Id<"rounds">) {
      const rr = (resultsByRound.get(roundId.toString()) ?? [])
        .map((r) => r.points)
        .sort((a, b) => b - a);
      if (rr.length < 2) return 0;
      return rr[0] - rr[1];
    }

    let worstRound = null,
      closestRound = null,
      blowoutRound = null;

    for (const r of finishedRounds) {
      const up = roundUpvoteStats(r._id);
      const diff = roundPointsDiff(r._id);
      if (!worstRound || up.top2Share > worstRound.metric) {
        worstRound = {
          roundId: r._id,
          title: r.title,
          imageUrl: await loadRoundImageUrl(r),
          metric: up.top2Share,
          submissions: up.submissions,
          totalUpvotes: up.totalUpvotes,
        };
      }
      if (!closestRound || diff < closestRound.metric) {
        closestRound = {
          roundId: r._id,
          title: r.title,
          imageUrl: await loadRoundImageUrl(r),
          metric: diff,
          submissions: up.submissions,
          totalUpvotes: up.totalUpvotes,
        };
      }
      if (!blowoutRound || diff > blowoutRound.metric) {
        blowoutRound = {
          roundId: r._id,
          title: r.title,
          imageUrl: await loadRoundImageUrl(r),
          metric: diff,
          submissions: up.submissions,
          totalUpvotes: up.totalUpvotes,
        };
      }
    }

    // Format final payload items
    const topSong = await (async () => {
      if (!topResult) return null;
      const submission = await loadSubmission(topResult.submissionId);
      if (!submission) return null;
      const submitter = memberMap.get(topResult.userId.toString());
      const { albumArtUrl } = await loadSubmissionMedia(submission);
      return {
        songTitle: submission.songTitle,
        artist: submission.artist,
        albumArtUrl,
        score: topResult.points,
        submittedBy: submitter?.name ?? "Unknown",
      };
    })();

    const mostUpvotedSong =
      mostUpvotedSongEntry && submissionIdMap.get(mostUpvotedSongEntry[0])
        ? await formatSongAwardFromSubmissionId(
          submissionIdMap.get(mostUpvotedSongEntry[0])!,
          mostUpvotedSongEntry[1],
        )
        : null;

    const mostDownvotedSong =
      mostDownvotedSongEntry && submissionIdMap.get(mostDownvotedSongEntry[0])
        ? await formatSongAwardFromSubmissionId(
          submissionIdMap.get(mostDownvotedSongEntry[0])!,
          mostDownvotedSongEntry[1],
        )
        : null;

    const fanFavoriteSong =
      favorite
        ? await formatSongAwardFromSubmissionId(
          favorite.subId,
          favorite.count,
        )
      : null;

    // Calculate top 10 songs
    const sortedResults = [...results].sort((a, b) => b.points - a.points);
    const top10Results = sortedResults.slice(0, 10);
    const top10SongsWithNulls = await Promise.all(
      top10Results.map(async (result) => {
        const submission = await loadSubmission(result.submissionId);
        if (!submission) return null;
        const submitter = memberMap.get(result.userId.toString());
        const { albumArtUrl } = await loadSubmissionMedia(submission);
        return {
          songTitle: submission.songTitle,
          artist: submission.artist,
          albumArtUrl,
          score: result.points,
          submittedBy: submitter?.name ?? "Unknown",
        };
      })
    );
    const top10Songs = top10SongsWithNulls.filter((song): song is NonNullable<typeof song> => song !== null);

    // Get all rounds summary
    const votesByRound = new Map<string, number>();
    votes.forEach((vote) => {
      const key = vote.roundId.toString();
      votesByRound.set(key, (votesByRound.get(key) ?? 0) + 1);
    });

    const allRounds = await Promise.all(
      allRoundsInLeague.map(async (round) => {
        const submissionCount =
          resultsByRound.get(round._id.toString())?.length ?? 0;
        const totalVotes = votesByRound.get(round._id.toString()) ?? 0;
        const imageUrl = await loadRoundImageUrl(round);

        return {
          roundId: round._id,
          title: round.title,
          imageUrl,
          status: round.status,
          submissionCount,
          totalVotes,
        };
      })
    );

    return {
      overlord: formatUserStat(overlord),
      peopleChampion: formatUserStat(peopleChampion),
      mostControversial: formatUserStat(mostControversial),
      prolificVoter: formatUserStat(prolificVoter),
      topSong,
      top10Songs,
      allRounds,
      mostUpvotedSong,
      mostDownvotedSong,
      fanFavoriteSong,
      attendanceStar: attendanceStar
        ? {
          ...(memberMap.get(attendanceStar.userId) ?? {}),
          count: attendanceStar.count,
          meta: { totalRounds },
        }
        : null,
      goldenEars: golden
        ? {
          ...(memberMap.get(golden.uid) ?? {}),
          count: Math.round(golden.average * 10) / 10,
          meta: { rounds: golden.rounds },
        }
        : null,
      consistencyKing: consist
        ? {
          ...(memberMap.get(consist.uid) ?? {}),
          count: Math.round(consist.dev * 10) / 10,
          meta: {
            rounds: consist.rounds,
            average: Math.round(consist.average * 10) / 10,
          },
        }
        : null,
      biggestDownvoter: downvoter
        ? { ...(memberMap.get(downvoter[0]) ?? {}), count: downvoter[1] }
        : null,
      worstRound,
      closestRound,
      blowoutRound,
      genreBreakdown,
    };
  },
});

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

    // Ensure permissions
    if (!league.isPublic) {
      const membership =
        userId &&
        (await ctx.db
          .query("memberships")
          .withIndex("by_league_and_user", (q) =>
            q.eq("leagueId", league._id).eq("userId", userId!),
          )
          .first());
      if (!membership) {
        return { rounds: [], songs: [] };
      }
    }

    const perCategoryLimit = Math.max(1, Math.min(args.limit ?? 5, 25));
    const roundSearchScanLimit = Math.max(50, Math.min(250, perCategoryLimit * 12));
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
      .filter((r) => {
        const t = r.title.toLowerCase();
        const d = r.description.toLowerCase();
        return t.includes(needle) || d.includes(needle);
      })
      .slice(0, perCategoryLimit)
      .map((r) => ({ _id: r._id, title: r.title }));

    const matchedSubs = await ctx.db
      .query("submissions")
      .withSearchIndex("by_text", (q) =>
        q.search("searchText", normalizedSearchText).eq("leagueId", args.leagueId),
      )
      .take(perCategoryLimit);

    const roundIds = [...new Set(matchedSubs.map((s) => s.roundId))];
    const roundDocs = await Promise.all(roundIds.map((rid) => ctx.db.get("rounds", rid)));
    const roundMap = new Map<string, Doc<"rounds">>();
    roundDocs.forEach((rd) => {
      if (rd) roundMap.set(rd._id.toString(), rd);
    });

    // Only include songs from rounds that are in voting or finished phases
    const filteredSubs = matchedSubs.filter((sub) => {
      const round = roundMap.get(sub.roundId.toString());
      return !!round && (round.status === "voting" || round.status === "finished");
    });

    const songs = await Promise.all(
      filteredSubs.map(async (sub) => {
        const round = roundMap.get(sub.roundId.toString());
        const { albumArtUrl, songFileUrl } = await resolveSubmissionMediaUrls(
          storage,
          sub,
        );
        return {
          _id: sub._id,
          songTitle: sub.songTitle,
          artist: sub.artist,
          albumArtUrl,
          songFileUrl,
          submissionType: sub.submissionType,
          songLink: sub.songLink ?? null,
          leagueId: sub.leagueId,
          leagueName: league.name,
          roundId: sub.roundId,
          roundTitle: round?.title,
        };
      }),
    );

    return { rounds: matchedRounds, songs };
  },
});
