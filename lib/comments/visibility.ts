type CommentIdentityVisibilityArgs = {
  isAnonymous?: boolean;
  revealOnRoundFinished?: boolean;
  roundStatus: "scheduled" | "submissions" | "voting" | "finished";
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
