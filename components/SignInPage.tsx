"use client";

import { FaDiscord } from "react-icons/fa";
import { Button } from "./ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const searchParams = useSearchParams();
  const handleSignIn = () => {
    // The redirect URL might be in the query params if the user was sent here
    // from a protected page.
    const redirectUrl = searchParams.get("redirect_url");

    signIn("discord", {
      redirectTo: redirectUrl || "/explore",
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-bold">Welcome to ZML</h1>
        <p className="text-muted-foreground">
          Sign in with Discord to use the app.
        </p>
      </div>
      <Button
        size="lg"
        onClick={handleSignIn}
        className="flex items-center gap-3 bg-[#5865F2] hover:bg-[#5865F2]/90"
      >
        <FaDiscord className="size-6" />
        Sign in with Discord
      </Button>
              <p className="text-xs">
          You have to be in the Music League Discord Server to Sign In.
        </p>
    </div>
  );
}