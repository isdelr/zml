// components/SignInPage.tsx
"use client";

import { FaDiscord } from "react-icons/fa";
import { Button } from "./ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const searchParams = useSearchParams();
  
  // 1. Read the `redirect_url` from the query parameters set by the middleware.
  const redirectUrl = searchParams.get("redirect_url");

  const handleSignIn = () => {
    // 2. Pass this URL as the `callbackUrl` to the `signIn` function.
    // The auth provider will use this URL to redirect the user after a
    // successful login with Discord.
    // We provide a fallback to `/explore` in case `redirect_url` is not present.
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
    </div>
  );
}