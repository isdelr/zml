import { describe, expect, it } from "vitest";

import { filterExploreLeagues } from "@/lib/explore/filter-leagues";

const leagues = [
  {
    _creationTime: 100,
    name: "Late Night Picks",
    description: "Private vibes and deep cuts",
    memberCount: 8,
    isActive: true,
  },
  {
    _creationTime: 300,
    name: "Chart Chasers",
    description: "Public pop favorites",
    memberCount: 20,
    isActive: false,
  },
  {
    _creationTime: 200,
    name: "Ambient Archive",
    description: "Slow burns for focused listening",
    memberCount: 12,
    isActive: true,
  },
];

describe("filterExploreLeagues", () => {
  it("filters by search term across league name and description", () => {
    expect(
      filterExploreLeagues(leagues, {
        searchTerm: "deep",
        activeTab: "All",
      }).map((league) => league.name),
    ).toEqual(["Late Night Picks"]);

    expect(
      filterExploreLeagues(leagues, {
        searchTerm: "chart",
        activeTab: "All",
      }).map((league) => league.name),
    ).toEqual(["Chart Chasers"]);
  });

  it("sorts by popularity and recency without mutating the source list", () => {
    expect(
      filterExploreLeagues(leagues, {
        searchTerm: "",
        activeTab: "Popular",
      }).map((league) => league.name),
    ).toEqual(["Chart Chasers", "Ambient Archive", "Late Night Picks"]);

    expect(
      filterExploreLeagues(leagues, {
        searchTerm: "",
        activeTab: "New",
      }).map((league) => league.name),
    ).toEqual(["Chart Chasers", "Ambient Archive", "Late Night Picks"]);

    expect(leagues.map((league) => league.name)).toEqual([
      "Late Night Picks",
      "Chart Chasers",
      "Ambient Archive",
    ]);
  });

  it("keeps only active leagues when the Active tab is selected", () => {
    expect(
      filterExploreLeagues(leagues, {
        searchTerm: "",
        activeTab: "Active",
      }).map((league) => league.name),
    ).toEqual(["Late Night Picks", "Ambient Archive"]);
  });
});
