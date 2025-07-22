// components/BottomNavbar.tsx
"use client";

import {
  Bookmark,
  Compass,
  PlusCircle,
  Send,
  Swords,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const mainNav = [
  { name: "Explore", icon: Compass, href: "/explore" },
  { name: "Active", icon: Swords, href: "/active-rounds" },
  { name: "Submissions", icon: Send, href: "/my-submissions" },
  { name: "Bookmarked", icon: Bookmark, href: "/bookmarked" },
];

export function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm">
      <div className="grid h-16 grid-cols-5 items-center justify-items-center">
        {mainNav.slice(0, 2).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 text-muted-foreground transition-colors hover:text-primary",
                isActive && "text-primary"
              )}
            >
              <item.icon className="size-5" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}

        <Link
          href="/leagues/create"
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <PlusCircle className="size-6" />
        </Link>

        {mainNav.slice(2, 4).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 text-muted-foreground transition-colors hover:text-primary",
                isActive && "text-primary"
              )}
            >
              <item.icon className="size-5" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}