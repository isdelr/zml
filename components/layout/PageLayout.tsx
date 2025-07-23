// components/layout/PageLayout.tsx
"use client";

import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { ReactNode, useEffect } from "react";
import { Sidebar } from "../Sidebar";
import { NowPlayingView } from "../NowPlayingView";
import { usePathname } from "next/navigation";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex
  );
  const {  actions } = useMusicPlayerStore();
  const pathname = usePathname();

  useEffect(() => {
    actions.closeContextView();
  }, [pathname, actions]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div 
        className={cn(
          "flex flex-1 flex-col overflow-y-auto",
          currentTrackIndex !== null && "pb-32"
        )}
      >
        {children}
      </div>
      <NowPlayingView />
    </div>
  );
}