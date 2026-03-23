import type { Doc } from "@/convex/_generated/dataModel";

type CommentIdentityVisibilityArgs = {
  isAnonymous?: boolean;
  revealOnRoundFinished?: boolean;
  roundStatus: Doc<"rounds">["status"];
};

export function shouldRevealCommentIdentity({
  isAnonymous,
  revealOnRoundFinished,
  roundStatus,
}: CommentIdentityVisibilityArgs): boolean {
  if (isAnonymous !== true) {
    return true;
  }

  if (roundStatus !== "finished") {
    return false;
  }

  return revealOnRoundFinished !== false;
}
