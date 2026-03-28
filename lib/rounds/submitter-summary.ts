import { getSubmissionCompletionCountsByUser } from "@/lib/rounds/submission-completion";

type MemberLike = {
  _id: string | { toString(): string };
  name?: string | null;
  image?: string | null;
};

type SubmissionLike = {
  userId: string | { toString(): string };
  collectionId?: string | null;
};

type SubmitterInfo = {
  name: string | null;
  image: string | null;
};

export function getRoundSubmitterSummary(
  members: MemberLike[] | undefined,
  submissions: SubmissionLike[] | undefined,
  submissionsPerUser: number,
  submissionMode: "single" | "multi" | "album" = "single",
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

  const counts = getSubmissionCompletionCountsByUser(submissions, submissionMode);

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
