import {
  getRequiredListenTimeSeconds as getAuthoritativeRequiredListenTimeSeconds,
  hasCompletedRequiredListenTime,
} from "@/lib/music/listen-progress";

const DEFAULT_TOLERANCE_SECONDS = 1.5;

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
  return getAuthoritativeRequiredListenTimeSeconds(
    durationSeconds,
    listenPercentage,
    listenTimeLimitMinutes,
  );
}

export function shouldMarkListenCompleted(
  listenedUntilSeconds: number,
  durationSeconds: number,
  listenPercentage: number | null | undefined,
  listenTimeLimitMinutes: number | null | undefined,
): boolean {
  return hasCompletedRequiredListenTime(
    listenedUntilSeconds,
    durationSeconds,
    listenPercentage,
    listenTimeLimitMinutes,
  );
}
