"use client";

import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";

export function HomeHero() {
  const { signIn } = useAuthActions();
  
  return (
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
  );
}