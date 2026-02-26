"use client";
import { useMemo, useState } from "react";
import { Clock, Play, Plus, Search, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { formatDeadline } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { toSvg } from "jdenticon";

const formatStatus = (status: "submissions" | "voting" | "finished") => {
  if (status === "submissions") return "Submissions Open";
  if (status === "voting") return "Voting Active";
  return "Finished";
};

export function ActiveRoundsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const activeRounds = useQuery(api.rounds.getActiveForUser, {});
  const isLoading = activeRounds === undefined;

  const filteredRounds = useMemo(() => {
    if (!activeRounds) return [];
    if (!searchTerm) return activeRounds;
    return activeRounds.filter(
      (round) =>
        round.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        round.leagueName.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [activeRounds, searchTerm]);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="p-4 md:p-8">
        <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <h1 className="text-4xl font-bold">Active Rounds</h1>
          <div className="relative w-full flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search in your active rounds..."
              className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link href="/leagues/create" className="md:block md:w-auto hidden">
            <Button>
              <Plus className="mr-2 size-4" />
              Create League
            </Button>
          </Link>
        </header>

        {isLoading ? (
          <div className="rounded-lg border border-dashed py-20 text-center">
            <h2 className="text-xl font-semibold">Loading Active Rounds</h2>
            <p className="mt-2 text-muted-foreground">
              Fetching your current rounds...
            </p>
          </div>
        ) : filteredRounds.length === 0 ? (
          <div className="rounded-lg border border-dashed py-20 text-center">
            <h2 className="text-xl font-semibold">
              {searchTerm ? "No Rounds Found" : "No Active Rounds"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {searchTerm
                ? "Try a different search term."
                : "Join or create a league to get started!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRounds.map((round) => (
              <Card
                key={round._id}
                className="group flex flex-col bg-card transition-colors hover:bg-accent"
              >
                <CardHeader>
                  <div className="relative mb-4">
                    {round.art ? (
                      <Image
                        src={round.art}
                        alt={round.leagueName}
                        width={250}
                        height={250}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    ) : (
                      <div
                        className="generated-art aspect-square w-full rounded-md bg-muted"
                        dangerouslySetInnerHTML={{
                          __html: toSvg(round._id, 250),
                        }}
                      />
                    )}
                  </div>
                  <CardTitle>{round.title}</CardTitle>
                  <CardDescription>
                    In{" "}
                    <span className="font-semibold text-foreground">
{round.leagueName}
</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4" />
                    <span>
{formatStatus(round.status)} • Ends{" "}
                      {formatDeadline(
                        round.status === "submissions"
                          ? round.submissionDeadline
                          : round.votingDeadline,
                      )}
</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link href={`/leagues/${round.leagueId}/round/${round._id}`} className="w-full">
                    <Button className="w-full font-bold">
                      {round.status === "voting" ? (
                        <>
                          <Play className="mr-2 size-4 fill-primary-foreground" />
                          Vote Now
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 size-4" />
                          Submit Track
                        </>
                      )}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
