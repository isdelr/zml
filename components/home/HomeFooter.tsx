import { AudioLines } from "lucide-react";
import Link from "next/link";

export function HomeFooter() {
  return (
    <footer className="border-t border-border/40">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <AudioLines className="size-6 text-primary" />
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by Isa.
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">
            Features
          </Link>
          <Link href="#faq" className="text-sm text-muted-foreground hover:text-foreground">
            FAQ
          </Link>
        </div>
      </div>
    </footer>
  );
}