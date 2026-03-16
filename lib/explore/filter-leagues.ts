export type ExploreLeagueTab = "All" | "Popular" | "New" | "Active";

export interface ExploreLeagueListItem {
  _creationTime: number;
  name: string;
  description: string;
  memberCount: number;
  isActive: boolean;
}

interface FilterExploreLeaguesOptions {
  searchTerm: string;
  activeTab: ExploreLeagueTab;
}

export function filterExploreLeagues<T extends ExploreLeagueListItem>(
  leagues: T[],
  { searchTerm, activeTab }: FilterExploreLeaguesOptions,
): T[] {
  let filtered = leagues;

  if (searchTerm) {
    const normalizedSearchTerm = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (league) =>
        league.name.toLowerCase().includes(normalizedSearchTerm) ||
        league.description.toLowerCase().includes(normalizedSearchTerm),
    );
  }

  if (activeTab === "Popular") {
    return [...filtered].sort((a, b) => b.memberCount - a.memberCount);
  }

  if (activeTab === "New") {
    return [...filtered].sort((a, b) => b._creationTime - a._creationTime);
  }

  if (activeTab === "Active") {
    return filtered.filter((league) => league.isActive);
  }

  return filtered;
}
