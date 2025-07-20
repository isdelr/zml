"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthActions } from "@convex-dev/auth/react";
import { Music, Users, Vote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useConvexAuth } from "convex/react";

export default function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const { signIn } = useAuthActions();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/explore"); // Redirect to a default authenticated page
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    // Replace the basic loading text with our new, engaging spinner
    return <LoadingSpinner />;
  }


  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex mx-auto h-14 max-w-screen-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Music className="size-6 text-primary" />
            <span className="font-bold">ZML</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => signIn("discord")}>
              Sign In
            </Button>
          </nav>
        </div>
      </header>
      {/* Main Content */}
      <main className="flex-1 container mx-auto">
        {/* Hero Section */}
        <section className="container grid place-items-center gap-6 pb-8 pt-6 text-center md:pb-12 md:pt-10 lg:py-32">
          <h1 className="text-4xl font-extrabold tracking-tighter md:text-5xl lg:text-6xl">
            Create, Compete & Discover Music
          </h1>
          <p className="max-w-[700px] text-lg text-muted-foreground">
            The ultimate platform to challenge your friends&apos; musical tastes.
            Create leagues, set themed rounds, and vote for the best tracks.
          </p>
          <div className="flex gap-4">
            <Button size="lg" onClick={() => signIn("discord")}>
              Create Your League
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container space-y-6  py-8  md:py-12 lg:py-24">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center pb-8">
            <h2 className="text-3xl font-bold leading-[1.1] md:text-4xl">
              How It Works
            </h2>
            <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
              Starting a music league is simple. Here&apos;s a quick rundown of how you can get started and what makes our platform unique.
            </p>
          </div>
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-col items-center">
                 <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="size-6" />
                </div>
                <CardTitle>Create or Join a League</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                Invite your friends to a private league. Compete head-to-head to see who has the best music taste.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-col items-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Music className="size-6" />
                </div>
                <CardTitle>Submit Songs</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                Each round has a theme. Submit your best track that fits the prompt and wait for the votes to roll in.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-col items-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Vote className="size-6" />
                </div>
                <CardTitle>Vote and Discover</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground">
                Anonymously vote on submissions. Discover new music from your friends and crown a winner for each round.
              </CardContent>
            </Card>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-6 md:px-8 md:py-0 md:h-18">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground">
            Made by Isa.
          </p>
      </footer>
    </div>
  );
}