// No "use client" directive - this is now a Server Component.
import { PageLayout } from "@/components/layout/PageLayout";
import { ExplorePage } from "@/components/ExplorePage";
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";

// Direct imports for the unauthenticated view
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeFeatures } from "@/components/home/HomeFeatures";
import { FeatureShowcase } from "@/components/home/FeatureShowcase";
import { HomeFAQ } from "@/components/home/HomeFAQ";
import { HomeCTA } from "@/components/home/HomeCTA";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Crown, ListMusic, Music, ThumbsUp, Users } from "lucide-react";

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
    <div className="flex min-h-screen flex-col bg-background text-foreground relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 grid grid-cols-2 -space-x-52 opacity-40 dark:opacity-20"
      >
        <div className="blur-[106px] h-56 bg-gradient-to-br from-primary to-purple-400 dark:from-blue-700"></div>
        <div className="blur-[106px] h-32 bg-gradient-to-r from-cyan-400 to-sky-300 dark:to-indigo-600"></div>
      </div>
      <HomeHeader />
      <main className="flex-1 mx-auto">
        <HomeHero />
        <HomeFeatures />

        <FeatureShowcase
          title="Competitive Themed Rounds"
          description="Challenge your friends or join public leagues. Each round has a unique theme, from '90s Rock' to 'Guilty Pleasures'. Submit your best track and see how it stacks up."
          imageUrl="/feature-1.png"
          reverse={false}
        >
          <div className="p-6 bg-card border rounded-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">90s Rock Anthems</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                Voting Active
              </span>
            </div>
            <div className="flex items-center gap-4 p-3 bg-accent rounded-md">
              <Music className="size-8 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Everlong</p>
                <p className="text-sm text-muted-foreground">Foo Fighters</p>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsUp className="size-5 text-green-500" />
                <span className="font-bold">12</span>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-accent/50 rounded-md">
              <Music className="size-8 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  Smells Like Teen Spirit
                </p>
                <p className="text-sm text-muted-foreground">Nirvana</p>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsUp className="size-5 text-green-500" />
                <span className="font-bold">8</span>
              </div>
            </div>
          </div>
        </FeatureShowcase>

        <FeatureShowcase
          title="Collaborative Discovery"
          description="Voting is anonymous, ensuring fairness and surprise. Discover incredible new music from your friends' submissions and build the ultimate collaborative playlist."
          imageUrl="/feature-2.png"
          reverse={true}
        >
          <div className="p-6 bg-card border rounded-lg space-y-4">
            <div className="flex items-center gap-2">
              <ListMusic className="size-5 text-primary" />
              <h3 className="font-bold text-lg">Round Playlist</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Discover and save new favorites from every round.
            </p>
            <div className="space-y-2 pt-2">
              <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-5/6 animate-pulse"></div>
            </div>
          </div>
        </FeatureShowcase>

        <FeatureShowcase
          title="Track Your Stats"
          description="See who truly has the best taste. Track your wins, total points, and rank in each league. Earn bragging rights with detailed stats and leaderboards."
          imageUrl="/feature-3.png"
          reverse={false}
        >
          <div className="p-6 bg-card border rounded-lg space-y-4">
            <div className="flex items-center gap-2">
              <Crown className="size-5 text-yellow-400" />
              <h3 className="font-bold text-lg">League Standings</h3>
            </div>
            <div className="flex items-center justify-between p-3 bg-accent rounded-md">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">1</span>
                <Users className="size-8 text-muted-foreground" />
                <p className="font-semibold text-foreground">You</p>
              </div>
              <span className="font-bold text-primary">128 pts</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-accent/50 rounded-md">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">2</span>
                <Users className="size-8 text-muted-foreground" />
                <p className="font-semibold text-foreground">Friend A</p>
              </div>
              <span className="font-bold text-foreground">115 pts</span>
            </div>
          </div>
        </FeatureShowcase>

        <HomeFAQ />
        <HomeCTA />
      </main>
      <HomeFooter />
    </div>
  );
}
