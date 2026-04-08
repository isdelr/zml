type RoundLike = {
  _id: string;
  status: string;
};

type SearchParamsInput = URLSearchParams | string;
type LeagueTab = "overview" | "stats";

function createSearchParams(searchParams: SearchParamsInput) {
  return new URLSearchParams(
    typeof searchParams === "string" ? searchParams : searchParams.toString(),
  );
}

function withQueryString(pathname: string, searchParams: URLSearchParams) {
  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildLeagueHref({
  leagueId,
  searchParams,
  tab = "overview",
}: {
  leagueId: string;
  searchParams: SearchParamsInput;
  tab?: LeagueTab;
}) {
  const nextSearchParams = createSearchParams(searchParams);
  nextSearchParams.delete("round");
  nextSearchParams.delete("tab");

  if (tab === "stats") {
    nextSearchParams.set("tab", "stats");
  }

  return withQueryString(`/leagues/${leagueId}`, nextSearchParams);
}

export function getPreferredRoundId(rounds: RoundLike[] | null | undefined) {
  if (!rounds || rounds.length === 0) {
    return null;
  }

  return (
    rounds.find((round) => round.status === "voting")?._id ??
    rounds.find((round) => round.status === "submissions")?._id ??
    rounds.find((round) => round.status === "scheduled")?._id ??
    rounds[0]?._id ??
    null
  );
}

export function buildLeagueRoundHref({
  leagueId,
  roundId,
  searchParams,
}: {
  leagueId: string;
  roundId: string;
  searchParams: SearchParamsInput;
}) {
  const nextSearchParams = createSearchParams(searchParams);
  nextSearchParams.delete("round");
  nextSearchParams.delete("tab");

  return withQueryString(
    `/leagues/${leagueId}/round/${roundId}`,
    nextSearchParams,
  );
}
