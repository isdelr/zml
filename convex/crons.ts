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

export default crons;