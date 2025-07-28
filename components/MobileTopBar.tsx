// components/MobileTopBar.tsx
"use client";

import { AudioLines, Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { useState } from "react";
import { MobileMenuSheet } from "./MobileMenuSheet";

export function MobileTopBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <AudioLines className="size-6 text-primary" />
          <span className="font-bold text-lg">ZML</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(true)}>
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </header>
      <MobileMenuSheet isOpen={isMenuOpen} onOpenChange={setIsMenuOpen} />
    </>
  );
}