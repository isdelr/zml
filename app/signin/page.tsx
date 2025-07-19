"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { FaDiscord } from "react-icons/fa";

export default function SignIn() {
  const { signIn } = useAuthActions();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-bold">Welcome to ZML</h1>
        <p className="text-muted-foreground">
          Sign in with Discord to create, compete, and discover music.
        </p>
      </div>
      <Button
        size="lg"
        onClick={() => signIn("discord")}
        className="flex items-center gap-3 bg-[#5865F2] hover:bg-[#5865F2]/90"
      >
        <FaDiscord className="size-6" />
        Sign in with Discord
      </Button>
    </div>
  );
}