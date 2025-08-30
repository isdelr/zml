"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";
import Link from "next/link";
import { Bell, LogOut, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MobileMenuSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMenuSheet({ isOpen, onOpenChange }: MobileMenuSheetProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const [showAllLeagues, setShowAllLeagues] = useState(false);
  // Using `any` here until Convex generated types are updated to include getLeaguesForUserFiltered
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLeaguesForUserFiltered: any = (api as any).leagues.getLeaguesForUserFiltered;
  const myLeagues = useQuery(getLeaguesForUserFiltered, { includeEnded: showAllLeagues });
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const { signOut } = useAuthActions();
  const clearQueue = useMusicPlayerStore((state) => state.actions.clearQueue);

  const handleLogout = async () => {
    clearQueue();
    await signOut();
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0 w-full sm:max-w-xs">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
          {isLoading ? (
            <div className="flex items-center gap-3 py-2">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="h-6 w-32" />
            </div>
          ) : isAuthenticated && currentUser ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Link href={`/profile/${currentUser._id}`} onClick={() => onOpenChange(false)}>
                <Avatar className="size-20 border-4 border-primary">
                  <AvatarImage src={currentUser.image ?? undefined} alt={currentUser.name ?? "User"} />
                  <AvatarFallback
                    dangerouslySetInnerHTML={{ __html: toSvg(currentUser._id, 80) }}
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
              <div className="w-full flex justify-around items-center pt-2">
                <div className="flex flex-col items-center">
                  <Link
                    href="/notifications"
                    onClick={() => onOpenChange(false)}
                    className="relative p-2 rounded-md hover:bg-accent"
                  >
                    <Bell className="size-6 text-muted-foreground" />
                    {unreadCount !== undefined && unreadCount > 0 && (
                      <span className="absolute -right-0 -top-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
{unreadCount}
</span>
                    )}
                  </Link>
                  <span className="text-xs text-muted-foreground">Notifications</span>
                </div>
                <div className="flex flex-col items-center">
                  <ThemeSwitcher />
                  <span className="text-xs text-muted-foreground">Theme</span>
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
                      title={showAllLeagues ? "Show active leagues only" : "View all leagues"}
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
                  {myLeagues === undefined ? (
                    <>
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-full" />
                    </>
                  ) : myLeagues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No leagues yet. Create one!</p>
                  ) : (
                    myLeagues.map((league) => (
                      <Link
                        key={league._id}
                        href={`/leagues/${league._id}`}
                        className={cn("flex items-center gap-3 text-sm font-semibold hover:text-foreground")}
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