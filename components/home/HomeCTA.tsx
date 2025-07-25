"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "../ui/button";

export function HomeCTA() {
  const { signIn } = useAuthActions();

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="relative overflow-hidden rounded-2xl bg-primary/10 px-6 py-12 text-center shadow-lg md:px-12">
           <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/10"></div>
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              Ready to Prove Your Music Taste?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Join thousands of music fans. Create your first league and invite your friends in just minutes.
            </p>
            <div className="mt-8">
              <Button size="lg" onClick={() => signIn("discord", { callbackUrl: "/leagues/create" })}>
                Get Started for Free
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}