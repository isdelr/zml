"use client";

import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Sidebar } from "../Sidebar";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex
  );

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div 
        className={cn(
          "flex flex-1 flex-col overflow-y-auto",
          currentTrackIndex !== null && "pb-32"
        )}
      >
        {children}
      </div>
    </div>
  );
}