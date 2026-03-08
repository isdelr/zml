"use client";
import { useState, useEffect, useRef } from "react";
import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { RoundDetail } from "@/components/RoundDetail";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildLeagueRoundHref,
  getPreferredRoundId,
} from "@/lib/leagues/navigation";
import { Standings } from "@/components/Standings";

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
  const searchParams = useSearchParams();
  const params = useParams();
  const { isLoading: isAuthLoading } = useConvexAuth();
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedRoundId = (
    typeof params.roundId === "string" ? params.roundId : null
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

  const leagueData = useQuery(
    api.leagues.get,
    isAuthLoading ? "skip" : { leagueId: parsedLeagueId },
  );

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

  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthLoading ? "skip" : {},
  );
  const { actions: playerActions } = useMusicPlayerStore();
  const preferredRoundId = getPreferredRoundId(rounds);

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

  const handleRoundSelect = (roundId: Id<"rounds">) => {
    router.push(
      buildLeagueRoundHref({
        leagueId,
        roundId,
        searchParams,
      }),
    );
  };

  useEffect(() => {
    if (
      (status === "CanLoadMore" || status === "Exhausted") &&
      rounds &&
      rounds.length > 0 &&
      !selectedRoundId
    ) {
      if (preferredRoundId) {
        router.replace(
          buildLeagueRoundHref({
            leagueId,
            roundId: preferredRoundId,
            searchParams,
          }),
        );
      }
    }
  }, [
    leagueId,
    preferredRoundId,
    rounds,
    router,
    searchParams,
    selectedRoundId,
    status,
  ]);

  const selectedRound = rounds?.find((r) => r._id === selectedRoundId);

  if (leagueData === undefined) {
    return (
      <div className="p-4 md:p-8">
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-6 w-full max-w-2xl" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="mt-8">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
        <div className="mt-8 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
        <div className="my-12 border-b border-border" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
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
        onSearchChange={handleSearchChange}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        searchContainerRef={searchContainerRef}
        searchResults={searchResults}
        handleRoundSelect={handleRoundSelect}
        playerActions={playerActions}
      />
      <LeagueInfo leagueData={leagueData} />
      <div className="mb-12 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <section className="overflow-hidden rounded-2xl border bg-card/60">
          <div className="border-b px-4 py-3">
            <h2 className="text-lg font-semibold">Standings</h2>
          </div>
          <div className="px-4 py-3 lg:h-[34rem] lg:overflow-y-auto lg:pr-3">
            <Standings leagueId={parsedLeagueId} />
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border bg-card/60">
          <div className="border-b px-4 py-3">
            <h2 className="text-lg font-semibold">Rounds</h2>
          </div>
          <div className="px-4 py-3 lg:h-[34rem] lg:overflow-y-auto lg:pr-3">
            <LeagueRounds
              rounds={rounds || []}
              hasLoaded={status !== "LoadingFirstPage"}
              selectedRoundId={selectedRoundId}
              leagueId={leagueId}
            />
          </div>
          {status === "CanLoadMore" && (
            <div className="border-t px-4 py-3">
              <Button onClick={() => loadMore(10)} variant="outline" className="w-full">
                Load More Rounds
              </Button>
            </div>
          )}
        </section>
      </div>
      {selectedRound && leagueData ? (
        <div className="mt-8">
          <RoundDetail
            round={selectedRound}
            league={leagueData}
            canManageLeague={leagueData.canManageLeague}
          />
        </div>
      ) : null}

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
