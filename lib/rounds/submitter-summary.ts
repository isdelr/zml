type MemberLike = {
  _id: string | { toString(): string };
  name?: string | null;
  image?: string | null;
};

type SubmissionLike = {
  userId: string | { toString(): string };
};

type SubmitterInfo = {
  name: string | null;
  image: string | null;
};

export function getRoundSubmitterSummary(
  members: MemberLike[] | undefined,
  submissions: SubmissionLike[] | undefined,
  submissionsPerUser: number,
): {
  completedSubmitters: SubmitterInfo[];
  missingSubmitters: SubmitterInfo[];
  totalMembers: number;
} {
  const allMembers = members ?? [];
  const totalMembers = allMembers.length;

  if (!submissions) {
    return {
      completedSubmitters: [],
      missingSubmitters: allMembers.map((member) => ({
        name: member.name ?? null,
        image: member.image ?? null,
      })),
      totalMembers,
    };
  }

  const counts = new Map<string, number>();
  for (const submission of submissions) {
    const userId = submission.userId.toString();
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }

  const completed = allMembers.filter(
    (member) => (counts.get(member._id.toString()) ?? 0) >= submissionsPerUser,
  );
  const missing = allMembers.filter(
    (member) => (counts.get(member._id.toString()) ?? 0) < submissionsPerUser,
  );

  return {
    completedSubmitters: completed.map((member) => ({
      name: member.name ?? null,
      image: member.image ?? null,
    })),
    missingSubmitters: missing.map((member) => ({
      name: member.name ?? null,
      image: member.image ?? null,
    })),
    totalMembers,
  };
}
