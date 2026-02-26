const DEFAULT_TOLERANCE_SECONDS = 1.5;
const DEFAULT_TIME_LIMIT_MINUTES = 999;

export function hasCompletedListenRequirement(
  serverCompleted: boolean,
  localCompleted: boolean,
): boolean {
  return serverCompleted || localCompleted;
}

export function clampSeekTargetToAllowedProgress(
  requestedSeconds: number,
  listenedUntilSeconds: number,
  durationSeconds?: number,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): number {
  const lastAllowed = listenedUntilSeconds + toleranceSeconds;
  if (requestedSeconds <= lastAllowed) {
    return requestedSeconds;
  }
  return Math.min(lastAllowed, durationSeconds || lastAllowed);
}

export function getRequiredListenTimeSeconds(
  durationSeconds: number,
  listenPercentage: number | null | undefined,
  listenTimeLimitMinutes: number | null | undefined,
): number {
  const requiredPercentage = (listenPercentage ?? 100) / 100;
  const timeLimitSeconds = (listenTimeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES) * 60;
  return Math.min(durationSeconds * requiredPercentage, timeLimitSeconds);
}

export function shouldMarkListenCompleted(
  listenedUntilSeconds: number,
  durationSeconds: number,
  listenPercentage: number | null | undefined,
  listenTimeLimitMinutes: number | null | undefined,
): boolean {
  const required = getRequiredListenTimeSeconds(
    durationSeconds,
    listenPercentage,
    listenTimeLimitMinutes,
  );
  return listenedUntilSeconds >= required;
}
