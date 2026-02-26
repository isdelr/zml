"use client";

import { useCallback } from "react";

type UploadSongResponse = {
  key: string;
};

type UploadSongErrorResponse = {
  error?: string;
  message?: string;
};

type UploadOptions = {
  onProgress?: (progress: number) => void;
};

export function useUploadSubmissionSongFile() {
  return useCallback(async (file: File, options?: UploadOptions) => {
    const formData = new FormData();
    formData.append("file", file);

    const key = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "/api/submissions/upload-song-file");

      xhr.upload.onprogress = (event) => {
        if (!options?.onProgress || !event.lengthComputable) {
          return;
        }
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        let payload: UploadSongResponse | UploadSongErrorResponse | null = null;
        try {
          payload = JSON.parse(xhr.responseText) as
            | UploadSongResponse
            | UploadSongErrorResponse;
        } catch {
          payload = null;
        }

        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          payload &&
          "key" in payload &&
          typeof payload.key === "string"
        ) {
          resolve(payload.key);
          return;
        }

        const errorPayload = payload as UploadSongErrorResponse | null;
        const errorMessage =
          errorPayload?.message ??
          errorPayload?.error ??
          `Song upload failed with status ${xhr.status}`;
        reject(new Error(errorMessage));
      };

      xhr.onerror = () => {
        reject(new Error("Song upload failed due to a network error."));
      };

      xhr.send(formData);
    });

    options?.onProgress?.(100);
    return key;
  }, []);
}
