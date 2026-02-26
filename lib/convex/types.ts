import type { FunctionReturnType } from "convex/server";
import { api } from "@/lib/convex/api";

export type LeagueData = NonNullable<FunctionReturnType<typeof api.leagues.get>>;
export type LeagueSearchResults = FunctionReturnType<typeof api.leagueViews.searchInLeague>;
export type RoundForLeague = FunctionReturnType<typeof api.rounds.getForLeague>["page"][number];
export type SubmissionForRound = FunctionReturnType<typeof api.submissions.getForRound>[number];
export type DuplicateSubmissionWarning = FunctionReturnType<
  typeof api.submissions.checkForPotentialDuplicates
>;
export type BookmarkedSong = FunctionReturnType<
  typeof api.bookmarks.getBookmarkedSongs
>[number];
export type UserVoteStatus = FunctionReturnType<typeof api.votes.getForUserInRound>;
