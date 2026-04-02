"use client";

import { getYouTubeOpenTarget } from "@/lib/youtube";

export const YOUTUBE_PLAYLIST_SESSION_EVENT =
  "zml:youtube-playlist-session";

type OpenUrlOptions = {
  fallbackToCurrentTab?: boolean;
  preferCurrentTab?: boolean;
};

type StorageReadWrite = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type StorageRead = Pick<Storage, "getItem">;

type SessionSnapshot = {
  active: boolean;
  done: boolean;
  opened: boolean;
  endAt: number | null;
  durationSec: number;
  remainingSec: number;
};

type SessionStorageOptions = {
  sessionStorage?: StorageReadWrite | null;
  localStorage?: StorageReadWrite | StorageRead | null;
  now?: number;
};

export function getRoundYouTubePlaylistSessionKeys(roundId: string) {
  const sessionKey = `ytPlaylist:${roundId}`;
  return {
    sessionKey,
    sessionOpenedKey: `${sessionKey}:opened`,
    sessionEndAtKey: `${sessionKey}:endAt`,
    sessionDurationKey: `${sessionKey}:duration`,
    sessionDoneKey: `${sessionKey}:done`,
  };
}

function getSessionStorage(
  storage?: StorageReadWrite | null,
): StorageReadWrite | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function getLocalStorage(
  storage?: StorageReadWrite | StorageRead | null,
): (StorageReadWrite | StorageRead) | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function dispatchRoundYouTubePlaylistSessionEvent(roundId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(YOUTUBE_PLAYLIST_SESSION_EVENT, {
      detail: { roundId },
    }),
  );
}

export function getRoundYouTubePlaylistSessionSnapshot(
  roundId: string,
  options: SessionStorageOptions = {},
): SessionSnapshot {
  const now = options.now ?? Date.now();
  const sessionStorage = getSessionStorage(options.sessionStorage);
  const localStorage = getLocalStorage(options.localStorage);
  const {
    sessionOpenedKey,
    sessionEndAtKey,
    sessionDurationKey,
    sessionDoneKey,
  } = getRoundYouTubePlaylistSessionKeys(roundId);

  try {
    const done = localStorage?.getItem(sessionDoneKey) === "1";
    const opened = sessionStorage?.getItem(sessionOpenedKey) === "1";
    const endAtValue = sessionStorage?.getItem(sessionEndAtKey);
    const durationValue = sessionStorage?.getItem(sessionDurationKey);
    const endAt = endAtValue ? Number(endAtValue) : null;
    const durationSec = durationValue ? Number(durationValue) : 0;
    const remainingSec =
      endAt && Number.isFinite(endAt)
        ? Math.max(0, Math.ceil((endAt - now) / 1000))
        : 0;

    return {
      active: remainingSec > 0,
      done,
      opened,
      endAt: endAt && Number.isFinite(endAt) ? endAt : null,
      durationSec:
        Number.isFinite(durationSec) && durationSec > 0
          ? Math.floor(durationSec)
          : 0,
      remainingSec,
    };
  } catch {
    return {
      active: false,
      done: false,
      opened: false,
      endAt: null,
      durationSec: 0,
      remainingSec: 0,
    };
  }
}

export function startRoundYouTubePlaylistSession(
  roundId: string,
  totalSec: number,
  options: SessionStorageOptions = {},
): SessionSnapshot {
  if (!roundId || !Number.isFinite(totalSec) || totalSec <= 0) {
    return getRoundYouTubePlaylistSessionSnapshot(roundId, options);
  }

  const sessionStorage = getSessionStorage(options.sessionStorage);
  const localStorage = getLocalStorage(options.localStorage);
  if (!sessionStorage || !localStorage) {
    return getRoundYouTubePlaylistSessionSnapshot(roundId, options);
  }

  const now = options.now ?? Date.now();
  const {
    sessionOpenedKey,
    sessionEndAtKey,
    sessionDurationKey,
    sessionDoneKey,
  } = getRoundYouTubePlaylistSessionKeys(roundId);

  try {
    if (localStorage.getItem(sessionDoneKey) === "1") {
      return {
        active: false,
        done: true,
        opened: sessionStorage.getItem(sessionOpenedKey) === "1",
        endAt: null,
        durationSec: 0,
        remainingSec: 0,
      };
    }

    const existingEndAt = Number(sessionStorage.getItem(sessionEndAtKey));
    const hasActiveExistingEndAt =
      Number.isFinite(existingEndAt) && existingEndAt > now;

    sessionStorage.setItem(sessionOpenedKey, "1");
    if (!hasActiveExistingEndAt) {
      const endAt = now + Math.floor(totalSec) * 1000;
      sessionStorage.setItem(sessionEndAtKey, String(endAt));
      sessionStorage.setItem(sessionDurationKey, String(Math.floor(totalSec)));
    }
  } catch {
    // Ignore storage failures and still notify listeners below.
  }

  dispatchRoundYouTubePlaylistSessionEvent(roundId);
  return getRoundYouTubePlaylistSessionSnapshot(roundId, options);
}

export function markRoundYouTubePlaylistDone(
  roundId: string,
  options: SessionStorageOptions = {},
) {
  const sessionStorage = getSessionStorage(options.sessionStorage);
  const localStorage = getLocalStorage(options.localStorage);
  const { sessionEndAtKey, sessionDurationKey, sessionDoneKey } =
    getRoundYouTubePlaylistSessionKeys(roundId);

  try {
    sessionStorage?.removeItem(sessionEndAtKey);
    sessionStorage?.removeItem(sessionDurationKey);
    if (
      localStorage &&
      "setItem" in localStorage &&
      typeof localStorage.setItem === "function"
    ) {
      localStorage.setItem(sessionDoneKey, "1");
    }
  } catch {
    // Ignore storage failures.
  }

  dispatchRoundYouTubePlaylistSessionEvent(roundId);
}

export function openUrlInNewTabWithFallback(
  url: string,
  options: OpenUrlOptions = {},
) {
  if (typeof window === "undefined") return false;
  if (options.preferCurrentTab) {
    window.location.assign(url);
    return true;
  }
  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (openedWindow) {
    return true;
  }

  if (options.fallbackToCurrentTab) {
    window.location.assign(url);
    return true;
  }

  return false;
}

export function openYouTubeUrlWithAppFallback(url: string) {
  const target = getYouTubeOpenTarget(url);
  return openUrlInNewTabWithFallback(target.url, {
    fallbackToCurrentTab: target.useCurrentTab,
    preferCurrentTab: target.useCurrentTab,
  });
}
