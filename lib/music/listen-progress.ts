const MIN_ALLOWED_PROGRESS_JUMP_SECONDS = 15;
const MAX_ALLOWED_PROGRESS_JUMP_SECONDS = 60;
const DEFAULT_SYNC_DELTA_SECONDS = 15;
const NEAR_END_THRESHOLD_SECONDS = 5;

type NextProgressSyncParams = {
  desiredProgressSeconds: number;
  lastSyncedProgressSeconds: number;
  durationSeconds: number;
};

function normalizeSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function getAllowedProgressJumpSeconds(durationSeconds: number): number {
  const normalizedDuration = normalizeSeconds(durationSeconds);
  return Math.min(
    MAX_ALLOWED_PROGRESS_JUMP_SECONDS,
    Math.max(
      MIN_ALLOWED_PROGRESS_JUMP_SECONDS,
      Math.floor(normalizedDuration * 0.1),
    ),
  );
}

export function getCappedProgressSeconds(
  existingProgressSeconds: number,
  reportedProgressSeconds: number,
  durationSeconds: number,
): number {
  const existing = normalizeSeconds(existingProgressSeconds);
  const reported = normalizeSeconds(reportedProgressSeconds);
  if (reported <= existing) return existing;

  const allowedJumpSeconds = getAllowedProgressJumpSeconds(durationSeconds);
  const delta = reported - existing;
  return existing + Math.min(delta, allowedJumpSeconds);
}

export function getNextProgressSecondsToSync({
  desiredProgressSeconds,
  lastSyncedProgressSeconds,
  durationSeconds,
}: NextProgressSyncParams): number | null {
  const desired = normalizeSeconds(desiredProgressSeconds);
  const lastSynced = normalizeSeconds(lastSyncedProgressSeconds);
  const duration = normalizeSeconds(durationSeconds);

  if (desired <= 0 || desired <= lastSynced) {
    return null;
  }

  const jumpDurationBasis = duration > 0 ? duration : desired;
  const allowedJumpSeconds = getAllowedProgressJumpSeconds(jumpDurationBasis);
  const capped = Math.min(desired, lastSynced + allowedJumpSeconds);
  const cappedDelta = capped - lastSynced;
  if (cappedDelta <= 0) {
    return null;
  }

  const backlogDetected = desired - lastSynced > allowedJumpSeconds;
  const nearEnd =
    duration > 0 && duration - desired <= NEAR_END_THRESHOLD_SECONDS;

  if (!backlogDetected && !nearEnd && cappedDelta < DEFAULT_SYNC_DELTA_SECONDS) {
    return null;
  }

  return capped;
}
