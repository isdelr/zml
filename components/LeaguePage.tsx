"use client";
import { useState, useEffect, useRef } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import {
  useRouter,
  useSearchParams,
  usePathname,
  useParams,
} from "next/navigation";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { RoundDetail } from "@/components/RoundDetail";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const LeagueHeader = dynamicImport(() =>
  import("@/components/league/LeagueHeader").then((mod) => ({
    default: mod.LeagueHeader,
  })),
);
const LeagueInfo = dynamicImport(() =>
  import("@/components/league/LeagueInfo").then((mod) => ({
    default: mod.LeagueInfo,
  })),
);
const LeagueTabs = dynamicImport(() =>
  import("@/components/league/LeagueTabs").then((mod) => ({
    default: mod.LeagueTabs,
  })),
);
const LeagueRounds = dynamicImport(() =>
  import("@/components/league/LeagueRounds").then((mod) => ({
    default: mod.LeagueRounds,
  })),
);
const LeagueJoinCard = dynamicImport(() =>
  import("@/components/league/LeagueJoinCard").then((mod) => ({
    default: mod.LeagueJoinCard,
  })),
);
const LeagueSettingsDialog = dynamicImport(() =>
  import("@/components/league/LeagueSettingsDialog").then((mod) => ({
    default: mod.LeagueSettingsDialog,
  })),
);

interface LeaguePageProps {
  leagueId: string;
}

export function LeaguePage({ leagueId }: LeaguePageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const activeTab = searchParams.get("tab") || "rounds";
  const selectedRoundId = (
    typeof params.roundId === "string"
      ? params.roundId
      : searchParams.get("round")
  ) as Id<"rounds"> | null;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const parsedLeagueId = leagueId as Id<"leagues">;
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (!value) {
      setDebouncedSearchTerm("");
    }
  };

  const leagueData = useQuery(api.leagues.get, {
    leagueId: parsedLeagueId,
  });

  const {
    results: rounds,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.rounds.getForLeague,
    { leagueId: parsedLeagueId, includeArt: true },
    { initialNumItems: 10 },
  );

  useEffect(() => {
    if (!searchTerm) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const searchResults = useQuery(
    api.leagueViews.searchInLeague,
    debouncedSearchTerm
      ? { leagueId: parsedLeagueId, searchText: debouncedSearchTerm }
      : "skip",
  );

  const currentUser = useQuery(api.users.getCurrentUser);
  const { actions: playerActions } = useMusicPlayerStore();

  const isLeagueFinished =
    rounds && rounds.length > 0 && rounds.every((r) => r.status === "finished");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchTerm("");
        setDebouncedSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchContainerRef]);

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    if (newTab !== "rounds") {
      params.delete("round");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleRoundSelect = (roundId: Id<"rounds">) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "rounds");
    params.set("round", roundId);
    router.push(
      `/leagues/${leagueId}/round/${roundId}?${searchParams.toString()}`,
    );
  };

  useEffect(() => {
    if (
      (status === "CanLoadMore" || status === "Exhausted") &&
      rounds &&
      rounds.length > 0 &&
      !selectedRoundId
    ) {
      const roundToSelect =
        rounds.find((r) => r.status === "voting") ??
        rounds.find((r) => r.status === "submissions") ??
        rounds[0] ??
        null;
      if (roundToSelect) {
        router.replace(`/leagues/${leagueId}/round/${roundToSelect._id}`);
      }
    }
  }, [status, rounds, selectedRoundId, leagueId, router]);

  const selectedRound = rounds?.find((r) => r._id === selectedRoundId);

  if (leagueData === undefined) return null;

  if (leagueData === null) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold">League Not Found</h1>
          <p className="mt-4 text-muted-foreground">
            This league does not exist or you may not have permission to view
            it.
          </p>
        </div>
      </div>
    );
  }

  if (!leagueData.isMember) {
    return <LeagueJoinCard leagueData={leagueData} rounds={rounds} />;
  }

  return (
    <div className="p-4 md:p-8">
      <LeagueHeader
        leagueData={leagueData}
        currentUser={currentUser}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        searchContainerRef={searchContainerRef}
        searchResults={searchResults}
        handleRoundSelect={handleRoundSelect}
        playerActions={playerActions}
      />
      <LeagueInfo leagueData={leagueData} />
      <LeagueTabs
        activeTab={activeTab}
        isLeagueFinished={isLeagueFinished}
        leagueId={parsedLeagueId}
        onTabChange={handleTabChange}
      >
        <LeagueRounds
          rounds={rounds || []}
          hasLoaded={status !== "LoadingFirstPage"}
          selectedRoundId={selectedRoundId}
          leagueId={leagueId}
        />
        {status === "CanLoadMore" && (
          <div className="mt-8 flex justify-center">
            <Button onClick={() => loadMore(10)} variant="outline">
              Load More Rounds
            </Button>
          </div>
        )}
        <div className="my-12 border-b border-border"></div>
        {selectedRound && leagueData ? (
          <RoundDetail
            round={selectedRound}
            league={leagueData}
            canManageLeague={leagueData.canManageLeague}
          />
        ) : null}
      </LeagueTabs>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <LeagueSettingsDialog
            league={leagueData}
            currentUser={currentUser}
            onClose={() => setIsSettingsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
