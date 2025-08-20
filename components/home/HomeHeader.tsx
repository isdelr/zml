"use client";
import { AudioLines } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function HomeHeader() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-24 px-2">
      <div className="container flex mx-auto h-14 max-w-screen-2xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <AudioLines className="size-6 text-primary" />
          <span className="font-bold">ZML</span>
        </Link>
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <Button asChild variant="ghost">
              <Link href="/explore">Open app</Link>
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => signIn("discord", { redirectTo: "/explore" })}
            >
              Sign In
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}