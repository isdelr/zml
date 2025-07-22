"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import {
  useRouter,
  useSearchParams,
  usePathname,
  useParams,
} from "next/navigation";
import { dynamicImport } from "./ui/dynamic-import";
import { RoundDetail } from "./RoundDetail";
import { Dialog, DialogContent } from "./ui/dialog";

// Dynamically import components
const LeagueHeader = dynamicImport(() =>
  import("./league/LeagueHeader").then((mod) => ({
    default: mod.LeagueHeader,
  })),
);
const LeagueInfo = dynamicImport(() =>
  import("./league/LeagueInfo").then((mod) => ({ default: mod.LeagueInfo })),
);
const LeagueTabs = dynamicImport(() =>
  import("./league/LeagueTabs").then((mod) => ({ default: mod.LeagueTabs })),
);
const LeagueRounds = dynamicImport(() =>
  import("./league/LeagueRounds").then((mod) => ({
    default: mod.LeagueRounds,
  })),
);
const LeagueJoinCard = dynamicImport(() =>
  import("./league/LeagueJoinCard").then((mod) => ({
    default: mod.LeagueJoinCard,
  })),
);
const LeagueSettingsDialog = dynamicImport(() =>
  import("./league/LeagueSettingsDialog").then((mod) => ({
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
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const activeTab = searchParams.get("tab") || "rounds";
  const selectedRoundId = (params.roundId ||
    searchParams.get("round")) as Id<"rounds"> | null;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const leagueData = useQuery(api.leagues.get, {
    id: leagueId as Id<"leagues">,
  });
  const rounds = useQuery(api.rounds.getForLeague, {
    leagueId: leagueId as Id<"leagues">,
  });
  const searchResults = useQuery(
    api.leagues.searchInLeague,
    searchTerm
      ? { leagueId: leagueId as Id<"leagues">, searchText: searchTerm }
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
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
    if (rounds && rounds.length > 0 && !selectedRoundId) {
      const latestRound = rounds.sort(
        (a, b) => b._creationTime - a._creationTime,
      )[0];
      router.replace(`/leagues/${leagueId}/round/${latestRound._id}`);
    }
  }, [rounds, selectedRoundId, leagueId, router]);

  const selectedRound = rounds?.find((r) => r._id === selectedRoundId);

  if (leagueData === undefined) {
    return null; // Loading state handled by parent
  }

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
        onSearchChange={setSearchTerm}
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
        leagueId={leagueId}
        onTabChange={handleTabChange}
      >
        <LeagueRounds
          rounds={rounds}
          selectedRoundId={selectedRoundId}
          leagueId={leagueId}
        />

        <div className="my-12 border-b border-border"></div>

        {selectedRound && leagueData ? (
          <RoundDetail
            round={selectedRound}
            league={{
              maxPositiveVotes: leagueData.maxPositiveVotes,
              maxNegativeVotes: leagueData.maxNegativeVotes,
            }}
            isOwner={leagueData.isOwner}
          />
        ) : null}
      </LeagueTabs>

      {/* Settings Dialog */}
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
