"use client";

import { Button } from "./ui/button";
import { useSearchParams } from "next/navigation";
import { signInWithDiscord } from "@/lib/auth-client";
import { DiscordIcon } from "@/components/icons/BrandIcons";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  unable_to_get_user_info:
    "We couldn't finish Discord sign-in. Make sure this Discord account is in the required server and try again.",
  state_mismatch:
    "Sign-in session expired or was blocked by browser privacy settings. Please try again.",
  state_not_found:
    "Sign-in session was not found. Please try again.",
  please_restart_the_process:
    "Sign-in session expired. Please start the sign-in flow again.",
  invalid_code:
    "Discord login code was invalid or expired. Please try again.",
  no_code: "Discord did not return a login code. Please try again.",
  no_callback_url: "Missing callback URL for login. Please try again.",
  oauth_provider_not_found: "Discord login provider is not configured correctly.",
  email_not_found:
    "Your Discord account must have a verified email address to sign in.",
};

export default function SignInPage() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const authErrorDescription = searchParams.get("error_description");
  const authErrorMessage = authError
    ? (OAUTH_ERROR_MESSAGES[authError] ??
      authError.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase()))
    : null;

  const handleSignIn = () => {
    // The redirect URL might be in the query params if the user was sent here
    // from a protected page.
    const redirectUrl = searchParams.get("redirect_url");

    void signInWithDiscord(redirectUrl || "/explore");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-bold">Welcome to ZML</h1>
        <p className="text-muted-foreground">
          Sign in with Discord to use the app.
        </p>
      </div>
      {authErrorMessage ? (
        <div className="w-full max-w-md rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{authErrorMessage}</p>
          {authErrorDescription ? (
            <p className="mt-1 text-xs text-destructive/90">{authErrorDescription}</p>
          ) : null}
        </div>
      ) : null}
      <Button
        size="lg"
        onClick={handleSignIn}
        className="flex items-center gap-3 bg-[#5865F2] hover:bg-[#5865F2]/90"
      >
        <DiscordIcon className="size-6" />
        Sign in with Discord
      </Button>
      <p className="text-xs">
        You have to be in the Music League Discord Server to Sign In.
      </p>
    </div>
  );
}
