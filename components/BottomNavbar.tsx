"use client";

import { Bell, Bookmark, Compass, PlusCircle, Send } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useConvexAuth } from "convex/react";

const mainNav = [
  { name: "Explore", icon: Compass, href: "/explore" },
  { name: "Notifications", icon: Bell, href: "/notifications" },
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
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <div className="grid min-h-16 grid-cols-5 items-center justify-items-center py-1">
        {/* Items before the plus button */}
        {navItems.slice(0, middleIndex).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-label={item.name}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex size-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive && "bg-accent text-primary",
              )}
            >
              <item.icon className="size-5" />
              <span className="sr-only">{item.name}</span>
            </Link>
          );
        })}

        {/* Create League Button */}
        <Link
          href="/leagues/create"
          aria-label="Create"
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <PlusCircle className="size-6" />
          <span className="sr-only">Create</span>
        </Link>

        {/* Items after the plus button */}
        {navItems.slice(middleIndex).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-label={item.name}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex size-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive && "bg-accent text-primary",
              )}
            >
              <item.icon className="size-5" />
              <span className="sr-only">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
