type IdLike = string | { toString(): string };

export type RoundSubmissionMode = "single" | "multi" | "album";

export type SubmissionCompletionLike = {
  userId: IdLike;
  collectionId?: string | null;
};

const toId = (value: IdLike) => value.toString();

function isCollectionMode(submissionMode: RoundSubmissionMode) {
  return submissionMode === "multi" || submissionMode === "album";
}

export function getSubmissionCompletionCountsByUser(
  submissions: SubmissionCompletionLike[] | undefined,
  submissionMode: RoundSubmissionMode,
): Map<string, number> {
  const counts = new Map<string, number>();
  const collectionCounts = new Map<string, Set<string>>();

  for (const submission of submissions ?? []) {
    const userId = toId(submission.userId);

    if (isCollectionMode(submissionMode)) {
      const collectionId = submission.collectionId?.trim();
      if (collectionId) {
        const collections = collectionCounts.get(userId) ?? new Set<string>();
        collections.add(collectionId);
        collectionCounts.set(userId, collections);
        continue;
      }
    }

    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }

  for (const [userId, collections] of collectionCounts.entries()) {
    counts.set(userId, (counts.get(userId) ?? 0) + collections.size);
  }

  return counts;
}

export function getUserSubmissionCompletionCount(
  submissions: SubmissionCompletionLike[] | undefined,
  submissionMode: RoundSubmissionMode,
  userId: IdLike,
): number {
  return (
    getSubmissionCompletionCountsByUser(submissions, submissionMode).get(
      toId(userId),
    ) ?? 0
  );
}
