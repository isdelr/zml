type IdLike = string | { toString(): string };

export type SubmissionOverflowLike = {
  _id: IdLike;
  userId: IdLike;
  _creationTime: number;
};

const toId = (value: IdLike) => value.toString();

function compareByCreationOrder(
  left: SubmissionOverflowLike,
  right: SubmissionOverflowLike,
) {
  if (left._creationTime !== right._creationTime) {
    return left._creationTime - right._creationTime;
  }

  return toId(left._id).localeCompare(toId(right._id));
}

export function getOverflowMultiRoundSubmissionIds(
  submissions: SubmissionOverflowLike[] | undefined,
  submissionsPerUser: number,
): string[] {
  if (!submissions || submissionsPerUser < 1) {
    return [];
  }

  const submissionsByUser = new Map<string, SubmissionOverflowLike[]>();

  for (const submission of submissions) {
    const userId = toId(submission.userId);
    const userSubmissions = submissionsByUser.get(userId) ?? [];
    userSubmissions.push(submission);
    submissionsByUser.set(userId, userSubmissions);
  }

  const overflowIds: string[] = [];

  for (const userSubmissions of submissionsByUser.values()) {
    const sortedSubmissions = [...userSubmissions].sort(compareByCreationOrder);
    const overflowSubmissions = sortedSubmissions.slice(submissionsPerUser);

    for (const submission of overflowSubmissions) {
      overflowIds.push(toId(submission._id));
    }
  }

  return overflowIds;
}
