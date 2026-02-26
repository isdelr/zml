import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { firstNonEmpty } from "@/lib/env";

const convexAuth = convexBetterAuthNextJs({
  convexUrl: firstNonEmpty(
    process.env.CONVEX_SELF_HOSTED_URL,
    process.env.NEXT_PUBLIC_CONVEX_URL,
  )!,
  convexSiteUrl: firstNonEmpty(
    process.env.CONVEX_SITE_URL,
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    "http://localhost:3211",
  )!,
});

export const { GET, POST } = convexAuth.handler;
