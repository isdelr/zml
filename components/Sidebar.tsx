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
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { ThemeSwitcher } from "./ThemeSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toSvg } from "jdenticon";
import { useState } from "react";
import { signOutFromApp } from "@/lib/auth-client";

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
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const [showAllLeagues, setShowAllLeagues] = useState(false);
  const myLeagues = useQuery(
    api.leagues.getLeaguesForUserFiltered,
    isAuthenticated ? { includeEnded: showAllLeagues } : "skip",
  );
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isAuthenticated ? {} : "skip",
  );
  const clearQueue = useMusicPlayerStore((state) => state.actions.clearQueue);
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex,
  );
  const pathname = usePathname();
  const router = useRouter();

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
              {currentUser && (
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarImage
                      src={
                        currentUser.image ??
                        currentUser.providerImageUrl ??
                        undefined
                      }
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
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuItem asChild disabled={!currentUser}>
              <Link
                href={currentUser ? `/profile/${currentUser._id}` : "#"}
                onMouseEnter={() => {
                  if (currentUser)
                    router.prefetch(`/profile/${currentUser._id}`);
                }}
              >
                <User className="mr-2 size-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                clearQueue();
                await signOutFromApp();
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
            onMouseEnter={() => router.prefetch(item.href)}
            className={cn(
              "flex items-center gap-4 text-sm font-semibold hover:text-foreground",
              pathname.startsWith(item.href) && "text-primary",
            )}
          >
            <div className="relative">
              <item.icon className="size-5" />
              {item.name === "Notifications" &&
                unreadCount !== undefined &&
                unreadCount > 0 && (
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
              onMouseEnter={() => router.prefetch(item.href)}
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            My Leagues
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAllLeagues((v) => !v)}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              aria-pressed={showAllLeagues}
              title={
                showAllLeagues ? "Show active leagues only" : "View all leagues"
              }
            >
              {showAllLeagues ? "Active only" : "View all"}
            </button>
            <Link
              href="/leagues/create"
              onMouseEnter={() => router.prefetch("/leagues/create")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
            </Link>
          </div>
        </div>
        <nav className="flex flex-col gap-4">
          {myLeagues &&
            myLeagues.map((league) => (
              <Link
                key={league._id}
                href={`/leagues/${league._id}`}
                onMouseEnter={() => router.prefetch(`/leagues/${league._id}`)}
                className={cn(
                  "flex items-center gap-3 text-sm font-semibold hover:text-foreground",
                )}
              >
                <Trophy className="size-5" />
                <span className="truncate">{league.name}</span>
              </Link>
            ))}
        </nav>
      </div>
    </aside>
  );
}
