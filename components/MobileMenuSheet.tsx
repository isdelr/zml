"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";
import Link from "next/link";
import {
  Bell,
  Bookmark,
  Compass,
  LogOut,
  Plus,
  PlusCircle,
  Send,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppearanceSettingsDialog } from "./AppearanceSettingsDialog";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { signOutFromApp } from "@/lib/auth-client";
import { usePathname } from "next/navigation";

interface MobileMenuSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMenuSheet({
  isOpen,
  onOpenChange,
}: MobileMenuSheetProps) {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
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

  const navigationItems = isAuthenticated
    ? [
        { name: "Explore", icon: Compass, href: "/explore" },
        { name: "Notifications", icon: Bell, href: "/notifications" },
        { name: "My Submissions", icon: Send, href: "/my-submissions" },
        { name: "Bookmarked", icon: Bookmark, href: "/bookmarked" },
        { name: "Create League", icon: PlusCircle, href: "/leagues/create" },
      ]
    : [
        { name: "Explore", icon: Compass, href: "/explore" },
        { name: "Create League", icon: PlusCircle, href: "/leagues/create" },
      ];

  const handleLogout = async () => {
    clearQueue();
    await signOutFromApp();
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 w-full sm:max-w-xs"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
          {isAuthenticated && currentUser ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Link
                href={`/profile/${currentUser._id}`}
                onClick={() => onOpenChange(false)}
              >
                <Avatar className="size-20 border-4 border-primary">
                  <AvatarImage
                    src={currentUser.image ?? undefined}
                    alt={currentUser.name ?? "User"}
                  />
                  <AvatarFallback
                    dangerouslySetInnerHTML={{
                      __html: toSvg(currentUser._id, 80),
                    }}
                  />
                </Avatar>
              </Link>
              <Link
                href={`/profile/${currentUser._id}`}
                onClick={() => onOpenChange(false)}
                className="text-xl font-bold hover:underline"
              >
                {currentUser.name}
              </Link>
              <div className="flex w-full justify-center pt-2">
                <div className="flex flex-col items-center">
                  <AppearanceSettingsDialog />
                  <span className="text-xs text-muted-foreground">
                    Appearance
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <p>Sign in to access your profile and settings.</p>
              <Button asChild className="mt-4">
                <Link href="/signin">Sign In</Link>
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Navigation
            </h2>
            <nav className="flex flex-col gap-2">
              {navigationItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-foreground",
                      isActive && "bg-accent text-foreground",
                    )}
                    onClick={() => onOpenChange(false)}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </span>
                    {item.name === "Notifications" &&
                      unreadCount !== undefined &&
                      unreadCount > 0 && (
                        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {isAuthenticated && (
            <>
              <div className="space-y-4">
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
                        showAllLeagues
                          ? "Show active leagues only"
                          : "View all leagues"
                      }
                    >
                      {showAllLeagues ? "Active only" : "View all"}
                    </button>
                    <Link
                      href="/leagues/create"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => onOpenChange(false)}
                    >
                      <Plus className="size-4" />
                    </Link>
                  </div>
                </div>
                <nav className="flex flex-col gap-4">
                  {myLeagues?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No leagues yet. Create one!
                    </p>
                  ) : (
                    myLeagues?.map((league) => (
                      <Link
                        key={league._id}
                        href={`/leagues/${league._id}`}
                        className={cn(
                          "flex items-center gap-3 text-sm font-semibold hover:text-foreground",
                        )}
                        onClick={() => onOpenChange(false)}
                      >
                        <Trophy className="size-5" />
                        <span className="truncate">{league.name}</span>
                      </Link>
                    ))
                  )}
                </nav>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive"
              >
                <LogOut className="mr-2 size-4" />
                Log out
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
