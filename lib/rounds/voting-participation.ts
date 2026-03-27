type IdLike = string | { toString(): string };

type MemberLike = {
  _id: IdLike;
  name?: string | null;
  image?: string | null;
  joinDate?: number | null;
};

type SubmissionLike = {
  userId: IdLike;
};

export type VotingEligibilityReason =
  | "submitted"
  | "missed_submission"
  | "joined_late"
  | "spectator"
  | "not_member"
  | "not_authenticated"
  | "unavailable";

type VotingRestrictionCopy = {
  title: string;
  description: string;
  shortStatus: string;
  voteLockedReason: string;
};

type VotingParticipant = {
  _id: string;
  name: string | null;
  image: string | null;
};

type VotingParticipationSummary = {
  finalizedVoters: VotingParticipant[];
  pendingVoters: VotingParticipant[];
  listeningOnlyMembers: VotingParticipant[];
  lateJoiners: VotingParticipant[];
};

const toId = (value: IdLike) => value.toString();

export function getVotingEligibilityReason(args: {
  hasSubmitted: boolean;
  joinDate?: number | null;
  submissionDeadline?: number | null;
  isSpectator?: boolean;
  isMember?: boolean;
  isAuthenticated?: boolean;
}): VotingEligibilityReason {
  if (args.isAuthenticated === false) {
    return "not_authenticated";
  }

  if (args.isMember === false) {
    return "not_member";
  }

  if (args.isSpectator) {
    return "spectator";
  }

  if (args.hasSubmitted) {
    return "submitted";
  }

  if (
    args.submissionDeadline !== undefined &&
    args.submissionDeadline !== null &&
    args.joinDate !== undefined &&
    args.joinDate !== null &&
    args.joinDate > args.submissionDeadline
  ) {
    return "joined_late";
  }

  return "missed_submission";
}

export function getVotingRestrictionCopy(
  reason: VotingEligibilityReason | null | undefined,
): VotingRestrictionCopy | null {
  switch (reason) {
    case "joined_late":
      return {
        title: "Round Already Underway",
        description:
          "You joined after submissions closed, so this round is listen-only for you. You can still listen to the full playlist and vote next round.",
        shortStatus: "Joined Late",
        voteLockedReason:
          "You joined after submissions closed, so this round is listen-only for you.",
      };
    case "missed_submission":
      return {
        title: "Listen-Only This Round",
        description:
          "You did not submit a song for this round, so voting is locked. You can still listen to the full playlist and jump back in next round.",
        shortStatus: "Listen Only",
        voteLockedReason:
          "You did not submit a song for this round, so voting is locked.",
      };
    case "not_member":
      return {
        title: "Join To Participate",
        description:
          "Join this league to submit and vote in future rounds. You can still listen here.",
        shortStatus: "View Only",
        voteLockedReason:
          "Join this league to submit songs and vote in future rounds.",
      };
    case "not_authenticated":
      return {
        title: "Sign In To Participate",
        description:
          "Sign in to submit songs and vote in future rounds. You can still listen here.",
        shortStatus: "View Only",
        voteLockedReason: "Sign in to submit songs and vote in this league.",
      };
    default:
      return null;
  }
}

export function getVotingParticipationSummary(args: {
  members: MemberLike[] | undefined;
  submissions: SubmissionLike[] | undefined;
  finalizedVoterIds: Iterable<string>;
  submissionDeadline?: number | null;
}): VotingParticipationSummary {
  const submissionUserIds = new Set(
    (args.submissions ?? []).map((submission) => toId(submission.userId)),
  );
  const finalizedVoterIds = new Set(args.finalizedVoterIds);

  const summary: VotingParticipationSummary = {
    finalizedVoters: [],
    pendingVoters: [],
    listeningOnlyMembers: [],
    lateJoiners: [],
  };

  for (const member of args.members ?? []) {
    const memberId = toId(member._id);
    const participant = {
      _id: memberId,
      name: member.name ?? null,
      image: member.image ?? null,
    };
    const reason = getVotingEligibilityReason({
      hasSubmitted: submissionUserIds.has(memberId),
      joinDate: member.joinDate,
      submissionDeadline: args.submissionDeadline,
    });

    if (reason === "submitted") {
      if (finalizedVoterIds.has(memberId)) {
        summary.finalizedVoters.push(participant);
      } else {
        summary.pendingVoters.push(participant);
      }
      continue;
    }

    if (reason === "joined_late") {
      summary.lateJoiners.push(participant);
      continue;
    }

    summary.listeningOnlyMembers.push(participant);
  }

  return summary;
}
