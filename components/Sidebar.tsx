"use client";

import { cn } from "@/lib/utils";
import { Bookmark, Compass, Plus, Send, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AddLeagueDialog } from "./AddLeagueDialog";
import { Skeleton } from "./ui/skeleton";

const mainNav = [{ name: "Explore Leagues", icon: Compass, href: "/explore" }];

const collectionNav = [
  { name: "Active Rounds", icon: Swords, href: "/active-rounds" },
  { name: "My Submissions", icon: Send, href: "/my-submissions" },
  { name: "Bookmarked", icon: Bookmark, href: "/bookmarked" },
];

export function Sidebar() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const myLeagues = useQuery(api.leagues.getLeaguesForUser);

  return (
    <aside className="flex w-64 flex-col bg-sidebar p-6 text-sidebar-foreground">
      <div className="mb-8 flex min-h-[32px] items-center gap-2">
        {currentUser === undefined ? (
          // Loading Skeleton
          <>
            <div className="flex size-8 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
          </>
        ) : (
          currentUser && (
            <>
              <Avatar className="size-8">
                <AvatarImage
                  src={currentUser.image}
                  alt={currentUser.name}
                />
                <AvatarFallback>
                  {currentUser.name?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-foreground">
                {currentUser.name}
              </span>
            </>
          )
        )}
      </div>

      <nav className="flex flex-col gap-4">
        {mainNav.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-4 text-sm font-semibold hover:text-foreground"
          >
            <item.icon className="size-5" />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          My Library
        </h2>
        <nav className="flex flex-col gap-4">
          {collectionNav.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-4 text-sm font-semibold hover:text-foreground"
            >
              <item.icon className="size-5" />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            My Leagues
          </h2>
          <AddLeagueDialog>
            <button className="text-muted-foreground hover:text-foreground">
              <Plus className="size-4" />
            </button>
          </AddLeagueDialog>
        </div>

        <nav className="flex flex-col gap-4">
          {myLeagues === undefined ? (
            <>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </>
          ) : (
            myLeagues.map((league) => (
              <Link
                key={league._id}
                href={`/league/${league._id}`}
                className={cn(
                  "flex items-center gap-3 text-sm font-semibold hover:text-foreground"
                )}
              >
                <Trophy className="size-5" />
                <span>{league.name}</span>
              </Link>
            ))
          )}
        </nav>
      </div>
    </aside>
  );
}