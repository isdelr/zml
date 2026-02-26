"use client";

import { Compass, PlusCircle, Send, Swords, Bookmark } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useConvexAuth } from "convex/react";

const mainNav = [
  { name: "Explore", icon: Compass, href: "/explore" },
  { name: "Active", icon: Swords, href: "/active-rounds" },
  { name: "Create", icon: PlusCircle, href: "/leagues/create" },
  { name: "Submissions", icon: Send, href: "/my-submissions" },
  { name: "Bookmarked", icon: Bookmark, href: "/bookmarked" },
];

export function BottomNavbar() {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();

  if (!isAuthenticated) return null;
  const navItems = mainNav.filter((item) => item.name !== "Create");

  const middleIndex = Math.floor(navItems.length / 2);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <div className="grid min-h-16 grid-cols-5 items-center justify-items-center py-1">
        {/* Items before the plus button */}
        {navItems.slice(0, middleIndex).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 text-muted-foreground transition-colors hover:text-primary",
                isActive && "text-primary",
              )}
            >
              <div className="relative">
                <item.icon className="size-5" />
              </div>
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}

        {/* Create League Button */}
        <Link
          href="/leagues/create"
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <PlusCircle className="size-6" />
        </Link>

        {/* Items after the plus button */}
        {navItems.slice(middleIndex).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 text-muted-foreground transition-colors hover:text-primary",
                isActive && "text-primary",
              )}
            >
              <div className="relative">
                <item.icon className="size-5" />
              </div>
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
