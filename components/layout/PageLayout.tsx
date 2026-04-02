// components/layout/PageLayout.tsx
"use client";

import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import {
  createMobileTopBarScrollState,
  updateMobileTopBarScrollState,
} from "@/lib/layout/mobile-top-bar-scroll";
import { cn } from "@/lib/utils";
import { ReactNode, RefObject, useEffect, useRef, useState } from "react";
import { Sidebar } from "../Sidebar";
import { NowPlayingView } from "../NowPlayingView";
import { usePathname } from "next/navigation";
import { InstallPWABanner } from "../InstallPWABanner";
import { MobileTopBar } from "../MobileTopBar";
import { NonBlockingErrorBoundary } from "../NonBlockingErrorBoundary";

interface PageLayoutProps {
  children: ReactNode;
}

function MobileTopBarScrollChrome({
  pathname,
  scrollContainerRef,
}: {
  pathname: string;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const mobileTopBarScrollStateRef = useRef(createMobileTopBarScrollState());
  const isMobileTopBarHiddenRef = useRef(false);
  const [isMobileTopBarHidden, setIsMobileTopBarHidden] = useState(false);

  useEffect(() => {
    isMobileTopBarHiddenRef.current = isMobileTopBarHidden;
  }, [isMobileTopBarHidden]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    mobileTopBarScrollStateRef.current = createMobileTopBarScrollState(
      container.scrollTop,
    );

    const handleScroll = () => {
      const nextScrollState = updateMobileTopBarScrollState(
        mobileTopBarScrollStateRef.current,
        container.scrollTop,
        Date.now(),
      );

      mobileTopBarScrollStateRef.current = nextScrollState;

      if (nextScrollState.hidden !== isMobileTopBarHiddenRef.current) {
        setIsMobileTopBarHidden(nextScrollState.hidden);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerRef]);

  useEffect(() => {
    isMobileTopBarHiddenRef.current = false;
    const container = scrollContainerRef.current;
    mobileTopBarScrollStateRef.current = createMobileTopBarScrollState(
      container?.scrollTop ?? 0,
    );
    const frameId = window.requestAnimationFrame(() => {
      setIsMobileTopBarHidden(false);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [pathname, scrollContainerRef]);

  return (
    <>
      <MobileTopBar hidden={isMobileTopBarHidden} />
      <div
        className={cn(
          "h-16 shrink-0 transition-[height] duration-200 xl:hidden",
          isMobileTopBarHidden && "h-0",
        )}
      />
    </>
  );
}

export function PageLayout({ children }: PageLayoutProps) {
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex,
  );
  const actions = useMusicPlayerStore((state) => state.actions);
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    actions.closeContextView();
  }, [pathname, actions]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex flex-1 flex-col overflow-y-auto",
          // Add extra padding if the music player is active.
          currentTrackIndex !== null && "pb-56 xl:pb-20",
        )}
      >
        <MobileTopBarScrollChrome
          pathname={pathname}
          scrollContainerRef={scrollContainerRef}
        />
        {children}
      </div>
      <InstallPWABanner />
      <NonBlockingErrorBoundary
        boundaryName="NowPlayingView"
        resetKey={pathname}
      >
        <NowPlayingView />
      </NonBlockingErrorBoundary>
    </div>
  );
}
