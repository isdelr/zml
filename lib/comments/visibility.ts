type CommentIdentityVisibilityArgs = {
  isAnonymous?: boolean;
  revealOnRoundFinished?: boolean;
  revealContentOnRoundFinished?: boolean;
  roundStatus: "scheduled" | "submissions" | "voting" | "finished";
};

export function shouldRevealCommentContent({
  revealContentOnRoundFinished,
  roundStatus,
}: Pick<
  CommentIdentityVisibilityArgs,
  "revealContentOnRoundFinished" | "roundStatus"
>): boolean {
  if (revealContentOnRoundFinished === true && roundStatus !== "finished") {
    return false;
  }

  return true;
}

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
