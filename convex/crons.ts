import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// This cron job runs every minute to check for rounds that need their state transitioned.
// e.g., from 'submissions' to 'voting', or 'voting' to 'finished'.
crons.interval(
  "Transition due rounds",
  { minutes: 1 }, // Runs every minute
  internal.rounds.transitionDueRounds
);

export default crons;