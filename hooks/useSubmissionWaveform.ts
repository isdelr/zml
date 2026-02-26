"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import WaveformData from "waveform-data";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/lib/convex/api";
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
  const audioContextRef = useRef<AudioContext | null>(null);

  const storeWaveform = useMutation(api.submissions.storeWaveform);
  const cachedWaveform = useQuery(
    api.submissions.getWaveform,
    currentTrack && currentTrack.submissionType === "file"
      ? { submissionId: currentTrack._id }
      : "skip",
  );

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
  }, []);

  useEffect(() => {
    if (
      currentTrack?.submissionType !== "file" ||
      !effectiveSongUrl ||
      !audioContextRef.current
    ) {
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
      const proxyUrl = `/api/storage-proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Waveform fetch failed with status ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      return new Promise<WaveformData>((resolve, reject) => {
        WaveformData.createFromAudio(
          {
            audio_context: audioContextRef.current!,
            array_buffer: buffer,
            scale: 1024,
          },
          (err, waveform) => {
            if (err || !waveform) {
              reject(err ?? new Error("Waveform generation failed"));
              return;
            }
            resolve(waveform);
          },
        );
      });
    };

    const run = async () => {
      queueMicrotask(() => {
        if (isCancelled) return;
        setIsWaveformLoading(true);
        setWaveformData(null);
      });

      if (cachedWaveform?.waveform) {
        try {
          const data = JSON.parse(cachedWaveform.waveform);
          const waveform = WaveformData.create(data);
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
        storeWaveform({
          submissionId: currentTrack._id,
          waveformJson: JSON.stringify(waveform.toJSON()),
        }).catch((error) => {
          console.warn("Failed to store waveform:", error);
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
          storeWaveform({
            submissionId: currentTrack._id,
            waveformJson: JSON.stringify(waveform.toJSON()),
          }).catch((error) => {
            console.warn("Failed to store waveform:", error);
          });
        } catch (retryError) {
          queueMicrotask(() => {
            if (isCancelled) return;
            setIsWaveformLoading(false);
          });
          console.warn("Waveform generation failed:", retryError);
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
    storeWaveform,
    getPresignedSongUrl,
    onPresignedUrlRefreshed,
    currentTrack,
  ]);

  return { waveformData, isWaveformLoading };
}
