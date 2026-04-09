import { parseWaveformJson } from "../submission/waveform-json";

const MIN_ALLOWED_PROGRESS_JUMP_SECONDS = 15;
const MAX_ALLOWED_PROGRESS_JUMP_SECONDS = 60;
const DEFAULT_SYNC_DELTA_SECONDS = 15;
const NEAR_END_THRESHOLD_SECONDS = 5;
const DEFAULT_TIME_LIMIT_MINUTES = 999;

export type PlaylistListenRequirementEntry<TSubmissionId = string> = {
  submissionIds: TSubmissionId[];
  durationSeconds: number;
};

export type PlaylistListenUnlock<TSubmissionId = string> = {
  submissionIds: TSubmissionId[];
  durationSeconds: number;
  requiredListenSeconds: number;
  unlockAfterSeconds: number;
};

type NextProgressSyncParams = {
  desiredProgressSeconds: number;
  lastSyncedProgressSeconds: number;
  durationSeconds: number;
};

type CanonicalSubmissionDurationInfoArgs = {
  submissionType: "file" | "youtube";
  durationSeconds: number | null | undefined;
  waveformJson?: string;
};

export type CanonicalSubmissionDurationInfo = {
  durationSec: number;
  derivedFromWaveform: boolean;
  shouldPersistDuration: boolean;
};

function normalizeSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function getPlaylistUnlocks<TSubmissionId>(
  entries: PlaylistListenRequirementEntry<TSubmissionId>[],
  getRequiredListenSeconds: (durationSeconds: number) => number,
): PlaylistListenUnlock<TSubmissionId>[] {
  let elapsedRequiredSeconds = 0;

  return entries.map((entry) => {
    const durationSeconds = getNormalizedDurationSeconds(entry.durationSeconds);
    const requiredListenSeconds = getRequiredListenSeconds(durationSeconds);

    elapsedRequiredSeconds += requiredListenSeconds;

    return {
      submissionIds: entry.submissionIds,
      durationSeconds,
      requiredListenSeconds,
      unlockAfterSeconds: elapsedRequiredSeconds,
    };
  });
}

export function getNormalizedDurationSeconds(durationSeconds: number): number {
  return normalizeSeconds(durationSeconds);
}

export function getDurationFromWaveformJson(
  waveformJson: string | undefined,
): number | null {
  if (!waveformJson) return null;

  try {
    const parsed = parseWaveformJson(waveformJson, { mode: "header" });
    const record = parsed?.waveform ?? (JSON.parse(waveformJson) as Record<string, unknown>);
    const length = Number(record.length);
    const samplesPerPixel = Number(record.samples_per_pixel);
    const sampleRate = Number(record.sample_rate);

    if (
      !Number.isFinite(length) ||
      !Number.isFinite(samplesPerPixel) ||
      !Number.isFinite(sampleRate)
    ) {
      return null;
    }
    if (length <= 0 || samplesPerPixel <= 0 || sampleRate <= 0) return null;

    const durationSec = Math.floor((length * samplesPerPixel) / sampleRate);
    return durationSec > 0 ? durationSec : null;
  } catch {
    return null;
  }
}

export function getCanonicalSubmissionDurationInfo({
  submissionType,
  durationSeconds,
  waveformJson,
}: CanonicalSubmissionDurationInfoArgs): CanonicalSubmissionDurationInfo | null {
  const normalizedStoredDuration = Number.isFinite(durationSeconds)
    ? getNormalizedDurationSeconds(durationSeconds as number)
    : null;

  if (submissionType === "file") {
    const waveformDurationSec = getDurationFromWaveformJson(waveformJson);
    if (waveformDurationSec !== null) {
      return {
        durationSec: waveformDurationSec,
        derivedFromWaveform: true,
        shouldPersistDuration: normalizedStoredDuration !== waveformDurationSec,
      };
    }
  }

  if (normalizedStoredDuration !== null) {
    return {
      durationSec: normalizedStoredDuration,
      derivedFromWaveform: false,
      shouldPersistDuration: false,
    };
  }

  if (submissionType === "youtube") {
    return {
      durationSec: 180,
      derivedFromWaveform: false,
      shouldPersistDuration: false,
    };
  }

  return null;
}

export function getRequiredListenTimeSeconds(
  durationSeconds: number,
  _listenPercentage: number | null | undefined,
  listenTimeLimitMinutes: number | null | undefined,
): number {
  const normalizedDurationSeconds = getNormalizedDurationSeconds(durationSeconds);
  if (normalizedDurationSeconds <= 0) return 0;

  const timeLimitSeconds = Math.max(
    0,
    (listenTimeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES) * 60,
  );

  return Math.min(normalizedDurationSeconds, Math.ceil(timeLimitSeconds));
}

export function hasCompletedRequiredListenTime(
  progressSeconds: number,
  durationSeconds: number,
  listenPercentage: number | null | undefined,
  listenTimeLimitMinutes: number | null | undefined,
): boolean {
  return (
    normalizeSeconds(progressSeconds) >=
    getRequiredListenTimeSeconds(
      durationSeconds,
      listenPercentage,
      listenTimeLimitMinutes,
    )
  );
}

export function getPlaylistListenUnlocks<TSubmissionId>(
  entries: PlaylistListenRequirementEntry<TSubmissionId>[],
  listenPercentage: number | null | undefined,
  listenTimeLimitMinutes: number | null | undefined,
): PlaylistListenUnlock<TSubmissionId>[] {
  return getPlaylistUnlocks(entries, (durationSeconds) =>
    getRequiredListenTimeSeconds(
      durationSeconds,
      listenPercentage,
      listenTimeLimitMinutes,
    ),
  );
}

export function getTotalPlaylistRequiredListenSeconds<TSubmissionId>(
  entries: PlaylistListenRequirementEntry<TSubmissionId>[],
  listenPercentage: number | null | undefined,
  listenTimeLimitMinutes: number | null | undefined,
): number {
  return getPlaylistListenUnlocks(
    entries,
    listenPercentage,
    listenTimeLimitMinutes,
  ).reduce((sum, entry) => sum + entry.requiredListenSeconds, 0);
}

export function getPlaylistFullDurationUnlocks<TSubmissionId>(
  entries: PlaylistListenRequirementEntry<TSubmissionId>[],
): PlaylistListenUnlock<TSubmissionId>[] {
  return getPlaylistUnlocks(entries, (durationSeconds) => durationSeconds);
}

export function getTotalPlaylistDurationSeconds<TSubmissionId>(
  entries: PlaylistListenRequirementEntry<TSubmissionId>[],
): number {
  return getPlaylistFullDurationUnlocks(entries).reduce(
    (sum, entry) => sum + entry.requiredListenSeconds,
    0,
  );
}

export function getUnlockedPlaylistSubmissionIds<TSubmissionId>(
  entries: PlaylistListenRequirementEntry<TSubmissionId>[],
  elapsedSeconds: number,
  listenPercentage: number | null | undefined,
  listenTimeLimitMinutes: number | null | undefined,
): TSubmissionId[] {
  const normalizedElapsedSeconds = normalizeSeconds(elapsedSeconds);

  return getPlaylistListenUnlocks(
    entries,
    listenPercentage,
    listenTimeLimitMinutes,
  )
    .filter((entry) => normalizedElapsedSeconds >= entry.unlockAfterSeconds)
    .flatMap((entry) => entry.submissionIds);
}

export function getUnlockedPlaylistSubmissionIdsByFullDuration<TSubmissionId>(
  entries: PlaylistListenRequirementEntry<TSubmissionId>[],
  elapsedSeconds: number,
): TSubmissionId[] {
  const normalizedElapsedSeconds = normalizeSeconds(elapsedSeconds);

  return getPlaylistFullDurationUnlocks(entries)
    .filter((entry) => normalizedElapsedSeconds >= entry.unlockAfterSeconds)
    .flatMap((entry) => entry.submissionIds);
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
