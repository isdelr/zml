// components/MobileTopBar.tsx
"use client";

import { AudioLines, Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { useState } from "react";
import { MobileMenuSheet } from "./MobileMenuSheet";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { cn } from "@/lib/utils";

type MobileTopBarProps = {
  hidden?: boolean;
};

export function MobileTopBar({ hidden = false }: MobileTopBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isAuthenticated ? {} : "skip",
  );

  return (
    <>
      <header
        className={cn(
          "md:hidden fixed top-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur transition-transform duration-200 supports-[backdrop-filter]:bg-background/60",
          hidden && "-translate-y-full",
        )}
      >
        <Link href="/" className="flex items-center gap-2">
          <AudioLines className="size-6 text-primary" />
          <span className="font-bold text-lg">ZML</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(true)}>
          <div className="relative">
            <Menu className="size-5" />
            {unreadCount !== undefined && unreadCount > 0 && (
              <span className="absolute -right-1 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="sr-only">Open menu</span>
        </Button>
      </header>
      <MobileMenuSheet isOpen={isMenuOpen} onOpenChange={setIsMenuOpen} />
    </>
  );
}
