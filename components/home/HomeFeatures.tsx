"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Users, Vote } from "lucide-react";

export function HomeFeatures() {
  return (
    <section id="features" className="container space-y-6 py-8 md:py-12 lg:py-24">
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
  );
}