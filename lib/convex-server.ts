import { NextjsOptions } from "convex/nextjs";
import { firstNonEmpty } from "@/lib/env";

/**
 * Server-side options for Convex queries.
 *
 * Inside Docker the Next.js server must talk to the Convex backend over the
 * internal network (`CONVEX_SELF_HOSTED_URL`), while the browser uses the
 * public `NEXT_PUBLIC_CONVEX_URL`. This merges the right URL into any
 * NextjsOptions passed to preloadQuery / fetchQuery / etc.
 */
export function serverOptions(opts?: NextjsOptions): NextjsOptions {
  const url = firstNonEmpty(
    process.env.CONVEX_SELF_HOSTED_URL,
    process.env.NEXT_PUBLIC_CONVEX_URL,
  );
  return {
    url,
    skipConvexDeploymentUrlCheck: Boolean(firstNonEmpty(process.env.CONVEX_SELF_HOSTED_URL)),
    ...opts,
  };
}
