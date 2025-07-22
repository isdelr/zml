"use client";

import { useConvexAuth } from "convex/react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";
import { ExplorePage } from "@/components/ExplorePage";

// Dynamically import components for the marketing page
const HomeHeader = dynamicImport(() =>
  import("@/components/home/HomeHeader").then((mod) => ({
    default: mod.HomeHeader,
  })),
);
const HomeHero = dynamicImport(() =>
  import("@/components/home/HomeHero").then((mod) => ({
    default: mod.HomeHero,
  })),
);
const HomeFeatures = dynamicImport(() =>
  import("@/components/home/HomeFeatures").then((mod) => ({
    default: mod.HomeFeatures,
  })),
);
const HomeFooter = dynamicImport(() =>
  import("@/components/home/HomeFooter").then((mod) => ({
    default: mod.HomeFooter,
  })),
);

export default function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // If the user is authenticated, render the Explore page within the standard app layout.
  // This makes the root URL act as the main app page for logged-in users
  // without interfering with redirects to other pages.
  if (isAuthenticated) {
    return (
      <PageLayout>
        <ExplorePage />
      </PageLayout>
    );
  }

  // If the user is not authenticated, show the marketing landing page.
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <HomeHeader />
      <main className="flex-1 container mx-auto">
        <HomeHero />
        <HomeFeatures />
      </main>
      <HomeFooter />
    </div>
  );
}