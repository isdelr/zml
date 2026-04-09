"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import WaveformData from "waveform-data";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
import { toErrorMessage } from "@/lib/errors";
import {
  parseWaveformJson,
  shouldRegenerateCachedWaveform,
} from "@/lib/submission/waveform-json";
import { Song } from "@/types";

type UseSubmissionWaveformArgs = {
  currentTrack: Song | null;
  effectiveSongUrl: string | null;
  getPresignedSongUrl: (args: {
    submissionId: Id<"submissions">;
  }) => Promise<string | null>;
  onPresignedUrlRefreshed?: (args: {
    submissionId: string;
    url: string;
  }) => void;
};

export function useSubmissionWaveform({
  currentTrack,
  effectiveSongUrl,
  getPresignedSongUrl,
  onPresignedUrlRefreshed,
}: UseSubmissionWaveformArgs): {
  waveformData: WaveformData | null;
  isWaveformLoading: boolean;
} {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const cachedWaveform = useQuery(
    api.submissions.getWaveform,
    currentTrack && currentTrack.submissionType === "file"
      ? { submissionId: currentTrack._id }
      : "skip",
  );

  useEffect(() => {
    if (currentTrack?.submissionType === "file" && effectiveSongUrl) {
      return;
    }

    setWaveformData(null);
    setIsWaveformLoading(false);
  }, [currentTrack?.submissionType, effectiveSongUrl]);

  useEffect(() => {
    if (currentTrack?.submissionType !== "file" || !effectiveSongUrl) {
      return;
    }

    let isCancelled = false;

    if (cachedWaveform === undefined) {
      queueMicrotask(() => {
        setIsWaveformLoading(true);
        setWaveformData(null);
      });
      return;
    }

    const generateWaveformFromUrl = async (url: string): Promise<WaveformData> => {
      const response = await fetch("/api/submissions/generate-waveform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submissionId: currentTrack._id,
          mediaUrl: url,
        }),
      });
      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          responseText || `Waveform generation failed with status ${response.status}`,
        );
      }
      const payload = (await response.json()) as { waveformJson?: string };
      if (!payload.waveformJson) {
        throw new Error("Waveform generation response is missing waveformJson.");
      }
      const parsed = parseWaveformJson(payload.waveformJson);
      if (!parsed?.isCurrent) {
        throw new Error("Waveform generation response contains an invalid payload.");
      }
      return WaveformData.create(parsed.waveform);
    };

    const run = async () => {
      queueMicrotask(() => {
        if (isCancelled) return;
        setIsWaveformLoading(true);
        setWaveformData(null);
      });

      if (cachedWaveform?.waveform && !shouldRegenerateCachedWaveform(cachedWaveform.waveform)) {
        try {
          const parsed = parseWaveformJson(cachedWaveform.waveform);
          if (!parsed?.isCurrent) {
            throw new Error("Cached waveform payload is stale.");
          }
          const waveform = WaveformData.create(parsed.waveform);
          queueMicrotask(() => {
            if (isCancelled) return;
            setWaveformData(waveform);
            setIsWaveformLoading(false);
          });
          return;
        } catch (err) {
          console.warn("Invalid cached waveform, regenerating:", err);
        }
      }

      try {
        const waveform = await generateWaveformFromUrl(effectiveSongUrl);
        queueMicrotask(() => {
          if (isCancelled) return;
          setWaveformData(waveform);
          setIsWaveformLoading(false);
        });
      } catch (initialError) {
        try {
          const refreshedUrl = await getPresignedSongUrl({
            submissionId: currentTrack._id,
          });
          if (!refreshedUrl) {
            throw initialError;
          }
          onPresignedUrlRefreshed?.({
            submissionId: currentTrack._id,
            url: refreshedUrl,
          });
          const waveform = await generateWaveformFromUrl(refreshedUrl);
          queueMicrotask(() => {
            if (isCancelled) return;
            setWaveformData(waveform);
            setIsWaveformLoading(false);
          });
        } catch (retryError) {
          queueMicrotask(() => {
            if (isCancelled) return;
            setIsWaveformLoading(false);
          });
          console.warn(
            "Waveform generation failed:",
            toErrorMessage(retryError, toErrorMessage(initialError)),
          );
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [
    currentTrack?._id,
    currentTrack?.submissionType,
    effectiveSongUrl,
    cachedWaveform,
    getPresignedSongUrl,
    onPresignedUrlRefreshed,
    currentTrack,
  ]);

  return { waveformData, isWaveformLoading };
}
