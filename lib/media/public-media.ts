import { ConvexHttpClient } from "convex/browser";
import {
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";
import { firstNonEmpty } from "@/lib/env";

let convexClient: ConvexHttpClient | null = null;

function getConvexClient() {
  if (!convexClient) {
    const convexUrl = firstNonEmpty(
      process.env.CONVEX_SELF_HOSTED_URL,
      process.env.NEXT_PUBLIC_CONVEX_URL,
    );
    if (!convexUrl) {
      throw new Error("Missing Convex URL for public media lookups.");
    }
    convexClient = new ConvexHttpClient(convexUrl);
  }

  return convexClient;
}

const getPublicAlbumArtKeyRef = makeFunctionReference<
  "query",
  { submissionId: string }
>(
  "submissions:getPublicAlbumArtKey",
) as unknown as FunctionReference<
  "query",
  "public",
  { submissionId: string }
>;

const getPublicRoundImageKeyRef = makeFunctionReference<
  "query",
  { roundId: string }
>(
  "rounds:getPublicImageKey",
) as unknown as FunctionReference<
  "query",
  "public",
  { roundId: string }
>;

const getPublicAvatarKeyRef = makeFunctionReference<
  "query",
  { userId: string }
>(
  "users:getPublicAvatarKey",
) as unknown as FunctionReference<
  "query",
  "public",
  { userId: string }
>;

export async function getPublicSubmissionAlbumArtKey(submissionId: string) {
  try {
    return await getConvexClient().query(getPublicAlbumArtKeyRef, {
      submissionId,
    });
  } catch {
    return null;
  }
}

export async function getPublicRoundImageKey(roundId: string) {
  try {
    return await getConvexClient().query(getPublicRoundImageKeyRef, { roundId });
  } catch {
    return null;
  }
}

export async function getPublicUserAvatarKey(userId: string) {
  try {
    return await getConvexClient().query(getPublicAvatarKeyRef, { userId });
  } catch {
    return null;
  }
}
