import { getToken } from "@convex-dev/better-auth/utils";
import { headers } from "next/headers";
import { firstNonEmpty } from "@/lib/env";

const getConvexSiteUrl = () => {
  return firstNonEmpty(
    process.env.CONVEX_SITE_URL,
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    "http://localhost:3211",
  )!;
};

export const getServerAuthToken = async () => {
  const requestHeaders = await headers();
  const { token } = await getToken(getConvexSiteUrl(), requestHeaders);
  return token;
};

export const isServerAuthenticated = async () => {
  const token = await getServerAuthToken();
  return Boolean(token);
};
