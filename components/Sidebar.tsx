// components/Sidebar.tsx
"use client";

import { cn } from "@/lib/utils";
import {
  Bell,
  Bookmark,
  ChevronDown,
  Compass,
  LogOut,
  Plus,
  Send,
  Swords,
  Trophy,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "./ui/skeleton";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { ThemeSwitcher } from "./ThemeSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useAuthActions } from "@convex-dev/auth/react";
import { toSvg } from "jdenticon";

const mainNav = [
  { name: "Explore Leagues", icon: Compass, href: "/explore" },
  { name: "Notifications", icon: Bell, href: "/notifications" },
];

const collectionNav = [
  { name: "Active Rounds", icon: Swords, href: "/active-rounds" },
  { name: "My Submissions", icon: Send, href: "/my-submissions" },
  { name: "Bookmarked", icon: Bookmark, href: "/bookmarked" },
];

export function Sidebar() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const myLeagues = useQuery(api.leagues.getLeaguesForUser);
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const clearQueue = useMusicPlayerStore((state) => state.actions.clearQueue);
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex,
  );
  const { signOut } = useAuthActions();
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden w-64 flex-col bg-sidebar p-6 text-sidebar-foreground md:flex",
        currentTrackIndex !== null && "pb-28",
      )}
    >
      <div className="mb-8 flex items-center justify-between gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex min-h-[32px] flex-1 cursor-pointer items-center gap-2 overflow-hidden">
              {currentUser === undefined ? (
                <>
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                </>
              ) : (
                currentUser && (
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage
                        src={currentUser.image}
                        alt={currentUser.name}
                      />
                      <AvatarFallback
                        dangerouslySetInnerHTML={{
                          __html: toSvg(currentUser._id, 32),
                        }}
                      />
                    </Avatar>
                    <span className="truncate font-semibold text-foreground">
                      {currentUser.name}
                    </span>
                    <ChevronDown className="size-4 mt-1.5" />
                  </div>
                )
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuItem asChild disabled={!currentUser}>
              <Link href={currentUser ? `/profile/${currentUser._id}` : "#"}>
                <User className="mr-2 size-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                clearQueue();
                await signOut();
              }}
              className="cursor-pointer"
            >
              <LogOut className="mr-2 size-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeSwitcher />
      </div>

      <nav className="flex flex-col gap-4">
        {mainNav.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-4 text-sm font-semibold hover:text-foreground",
              pathname.startsWith(item.href) && "text-primary",
            )}
          >
            <div className="relative">
              <item.icon className="size-5" />
              {item.name === "Notifications" && unreadCount !== undefined && unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
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
              className={cn(
                "flex items-center gap-4 text-sm font-semibold hover:text-foreground",
                pathname.startsWith(item.href) && "text-primary",
              )}
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
          <Link
            href="/leagues/create"
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-4" />
          </Link>
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
                href={`/leagues/${league._id}`}
                className={cn(
                  "flex items-center gap-3 text-sm font-semibold hover:text-foreground",
                )}
              >
                <Trophy className="size-5" />
                <span className="truncate">{league.name}</span>
              </Link>
            ))
          )}
        </nav>
      </div>
    </aside>
  );
}