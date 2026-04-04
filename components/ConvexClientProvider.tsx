"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { ConvexFatalErrorRecovery } from "@/components/providers/ConvexFatalErrorRecovery";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexBetterAuthProvider authClient={authClient} client={convex}>
      <ConvexFatalErrorRecovery />
      {children}
    </ConvexBetterAuthProvider>
  );
}
