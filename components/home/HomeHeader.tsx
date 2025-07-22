"use client";

import { Music } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";

export function HomeHeader() {
  const { signIn } = useAuthActions();
  
  return (
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
  );
}