"use client";

import { Bell, Compass, PlusCircle, Send, Swords } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isAuthenticated } from "@/convex/auth";

const mainNav = [
  { name: "Explore", icon: Compass, href: "/explore" },
  { name: "Active", icon: Swords, href: "/active-rounds" },

  { name: "Create", icon: PlusCircle, href: "/leagues/create" },
  { name: "Submissions", icon: Send, href: "/my-submissions" },
  { name: "Notifications", icon: Bell, href: "/notifications" },
];

export function BottomNavbar() {
  const pathname = usePathname();
  const unreadCount = useQuery(api.notifications.getUnreadCount);

  if (!isAuthenticated) return null;
  const navItems = [mainNav[0], mainNav[1], mainNav[3], mainNav[4]];

  const middleIndex = Math.floor(navItems.length / 2);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm">
      <div className="grid h-16 grid-cols-5 items-center justify-items-center">
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
                {item.name === "Notifications" &&
                  unreadCount !== undefined &&
                  unreadCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
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
                {item.name === "Notifications" &&
                  unreadCount !== undefined &&
                  unreadCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
              </div>
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
