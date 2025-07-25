// No "use client" directive - this is now a Server Component.
import { PageLayout } from "@/components/layout/PageLayout";
import { ExplorePage } from "@/components/ExplorePage";
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Direct imports for the unauthenticated view
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeFeatures } from "@/components/home/HomeFeatures";
import { HomeFooter } from "@/components/home/HomeFooter";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";

export default async function HomePage() {
  const userIsAuthenticated = await isAuthenticatedNextjs();

  // If the user is authenticated, show the Explore page with preloaded data.
  if (userIsAuthenticated) {
    const preloadedLeagues = await preloadQuery(api.leagues.getPublicLeagues);
    return (
      <PageLayout>
        <ExplorePage preloadedLeagues={preloadedLeagues} />
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