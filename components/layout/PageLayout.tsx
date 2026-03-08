// components/layout/PageLayout.tsx
"use client";

import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Sidebar } from "../Sidebar";
import { NowPlayingView } from "../NowPlayingView";
import { usePathname } from "next/navigation";
import { InstallPWABanner } from "../InstallPWABanner";
import { MobileTopBar } from "../MobileTopBar";
import { NonBlockingErrorBoundary } from "../NonBlockingErrorBoundary";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex,
  );
  const { actions } = useMusicPlayerStore();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const [isMobileTopBarHidden, setIsMobileTopBarHidden] = useState(false);

  useEffect(() => {
    actions.closeContextView();
  }, [pathname, actions]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    lastScrollTopRef.current = container.scrollTop;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const scrollDelta = currentScrollTop - lastScrollTopRef.current;

      if (currentScrollTop <= 8) {
        setIsMobileTopBarHidden(false);
      } else if (scrollDelta > 8) {
        setIsMobileTopBarHidden(true);
      } else if (scrollDelta < -8) {
        setIsMobileTopBarHidden(false);
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    setIsMobileTopBarHidden(false);
    const container = scrollContainerRef.current;
    if (container) {
      lastScrollTopRef.current = container.scrollTop;
    }
  }, [pathname]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex flex-1 flex-col overflow-y-auto",
          // Add extra padding if the music player is active.
          currentTrackIndex !== null && "pb-56 md:pb-20",
        )}
      >
        <MobileTopBar hidden={isMobileTopBarHidden} />
        <div
          className={cn(
            "h-16 shrink-0 transition-[height] duration-200 md:hidden",
            isMobileTopBarHidden && "h-0",
          )}
        />
        {children}
      </div>
      <InstallPWABanner />
      <NonBlockingErrorBoundary boundaryName="NowPlayingView" resetKey={pathname}>
        <NowPlayingView />
      </NonBlockingErrorBoundary>
    </div>
  );
}
