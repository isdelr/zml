import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// This cron job runs every minute to check for rounds that need their state transitioned.
// e.g., from 'submissions' to 'voting', or 'voting' to 'finished'.
crons.interval(
  "Transition due rounds",
  { minutes: 1 },
  internal.rounds.transitionDueRounds
);

// Keep V8 runtime warm to avoid cold-start latency on user-facing queries.
crons.interval(
  "Keepalive",
  { minutes: 2 },
  internal.presence.keepalive
);

crons.interval(
  "Process queued submission audio",
  { minutes: 1 },
  internal.submissions.processPendingSubmissionAudioQueue,
  { limit: 10 },
);

crons.interval(
  "Cleanup stale storage uploads",
  { hours: 6 },
  internal.files.cleanupStaleStorageUploads,
  { limit: 100 },
);

export default crons;
