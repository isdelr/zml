"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { dynamicImport } from "@/components/ui/dynamic-import";

// Dynamically import components
const HomeHeader = dynamicImport(() => import("@/components/home/HomeHeader").then(mod => ({ default: mod.HomeHeader })));
const HomeHero = dynamicImport(() => import("@/components/home/HomeHero").then(mod => ({ default: mod.HomeHero })));
const HomeFeatures = dynamicImport(() => import("@/components/home/HomeFeatures").then(mod => ({ default: mod.HomeFeatures })));
const HomeFooter = dynamicImport(() => import("@/components/home/HomeFooter").then(mod => ({ default: mod.HomeFooter })));

export default function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/explore"); // Redirect to a default authenticated page
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return <LoadingSpinner />;
  }

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