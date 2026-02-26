"use client";

import { useAction } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useCallback } from "react";

type UploadUrlResponse = {
  url: string;
  key: string;
};

type UploadUrlAction = FunctionReference<
  "action",
  "public",
  Record<string, never>,
  UploadUrlResponse
>;

type SyncMetadataAction = FunctionReference<
  "action",
  "public",
  { key: string },
  unknown
>;

type UploadApi = {
  generateUploadUrl: UploadUrlAction;
  syncMetadata: SyncMetadataAction;
};

type UploadOptions = {
  onProgress?: (progress: number) => void;
};

function uploadWithProgress(
  url: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed due to a network error."));
    };

    xhr.send(file);
  });
}

function uploadViaProxyWithProgress(
  key: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("key", key);
    formData.append("file", file);

    xhr.open("POST", "/api/storage/upload-file");

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Proxy upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Proxy upload failed due to a network error."));
    };

    xhr.send(formData);
  });
}

export function useUploadFile(api: UploadApi) {
  const generateUploadUrl = useAction(api.generateUploadUrl);
  const syncMetadata = useAction(api.syncMetadata);

  return useCallback(
    async (file: File, options?: UploadOptions) => {
      const { url, key } = await generateUploadUrl({});

      try {
        await uploadWithProgress(url, file, options?.onProgress);
      } catch {
        await uploadViaProxyWithProgress(key, file, options?.onProgress);
      }
      await syncMetadata({ key });
      return key;
    },
    [generateUploadUrl, syncMetadata],
  );
}
