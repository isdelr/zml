"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Music, Users } from "lucide-react";
import { AvatarStack } from "../AvatarStack";

export function HomeHero() {
  const { signIn } = useAuthActions();

  const mockUsers = [
    { name: "Alex", image: "https://i.pravatar.cc/32?u=a" },
    { name: "Maria", image: "https://i.pravatar.cc/32?u=b" },
    { name: "Chris", image: "https://i.pravatar.cc/32?u=c" },
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="container relative grid place-items-center gap-8 px-4 py-16 text-center md:py-24 lg:py-32">
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
            The Ultimate Music League
          </h1>
          <p className="mx-auto max-w-[700px] text-lg text-muted-foreground md:text-xl">
            Challenge your friends, discover new tracks, and prove your taste.
            Create leagues, set themed rounds, and vote for the best music.
          </p>
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              onClick={() =>
                signIn("discord", { redirectTo: "/leagues/create" })
              }
            >
              Create Your League
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => signIn("discord", { redirectTo: "/explore" })}
            >
              Explore Leagues
            </Button>
          </div>
        </div>

        {/* Mock UI Element */}
        <Card className="relative mt-8 w-full max-w-lg animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center gap-2 p-3 border-b">
            <span className="size-3 rounded-full bg-red-500"></span>
            <span className="size-3 rounded-full bg-yellow-500"></span>
            <span className="size-3 rounded-full bg-green-500"></span>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                Indie Throwbacks
              </h3>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <AvatarStack users={mockUsers} />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-accent rounded-md">
              <Music className="size-6 text-primary" />
              <div>
                <p className="font-semibold text-foreground">1901</p>
                <p className="text-sm text-muted-foreground">Phoenix</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-md">
              <Music className="size-6 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Young Folks</p>
                <p className="text-sm text-muted-foreground">
                  Peter Bjorn and John
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}