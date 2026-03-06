type RoundLike = {
  _id: string;
  status: string;
};

type SearchParamsInput = URLSearchParams | string;

function createSearchParams(searchParams: SearchParamsInput) {
  return new URLSearchParams(
    typeof searchParams === "string" ? searchParams : searchParams.toString(),
  );
}

function withQueryString(pathname: string, searchParams: URLSearchParams) {
  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function getPreferredRoundId(rounds: RoundLike[] | null | undefined) {
  if (!rounds || rounds.length === 0) {
    return null;
  }

  return (
    rounds.find((round) => round.status === "voting")?._id ??
    rounds.find((round) => round.status === "submissions")?._id ??
    rounds[0]?._id ??
    null
  );
}

export function buildLeagueTabHref({
  leagueId,
  tab,
  searchParams,
  selectedRoundId,
  fallbackRoundId,
}: {
  leagueId: string;
  tab: string;
  searchParams: SearchParamsInput;
  selectedRoundId?: string | null;
  fallbackRoundId?: string | null;
}) {
  const nextSearchParams = createSearchParams(searchParams);
  nextSearchParams.set("tab", tab);
  nextSearchParams.delete("round");

  if (tab !== "rounds") {
    return withQueryString(`/leagues/${leagueId}`, nextSearchParams);
  }

  const roundId = selectedRoundId ?? fallbackRoundId;
  if (!roundId) {
    return withQueryString(`/leagues/${leagueId}`, nextSearchParams);
  }

  return withQueryString(
    `/leagues/${leagueId}/round/${roundId}`,
    nextSearchParams,
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
  nextSearchParams.set("tab", "rounds");
  nextSearchParams.delete("round");

  return withQueryString(
    `/leagues/${leagueId}/round/${roundId}`,
    nextSearchParams,
  );
}
