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

const MULTIPART_UPLOAD_THRESHOLD_BYTES = 64 * 1024 * 1024;
const MULTIPART_UPLOAD_CHUNK_BYTES = 16 * 1024 * 1024;

type MultipartStartResponse = {
  key: string;
  uploadId: string;
};

type MultipartPartResponse = {
  etag: string;
  partNumber: number;
};

function uploadViaAppServerWithProgress(
  key: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", `/api/storage/upload-file?key=${encodeURIComponent(key)}`);
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

function uploadChunkViaAppServer(
  url: string,
  chunk: Blob,
  uploadedBytesBeforeChunk: number,
  totalBytes: number,
  onProgress?: (progress: number) => void,
): Promise<MultipartPartResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", url);
    xhr.setRequestHeader(
      "Content-Type",
      chunk.type || "application/octet-stream",
    );

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }
      const uploadedBytes = Math.min(
        totalBytes,
        uploadedBytesBeforeChunk + event.loaded,
      );
      onProgress(Math.round((uploadedBytes / totalBytes) * 100));
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed with status ${xhr.status}`));
        return;
      }

      try {
        resolve(JSON.parse(xhr.responseText) as MultipartPartResponse);
      } catch (error) {
        reject(error);
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed due to a network error."));
    };

    xhr.send(chunk);
  });
}

async function uploadMultipartViaAppServerWithProgress(
  key: string,
  file: File,
  onProgress?: (progress: number) => void,
) {
  const startUrl = `/api/storage/upload-file?action=multipart-start&key=${encodeURIComponent(
    key,
  )}`;
  const startResponse = await fetch(startUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });
  if (!startResponse.ok) {
    throw new Error(`Multipart upload failed to start with status ${startResponse.status}`);
  }

  const { uploadId } = (await startResponse.json()) as MultipartStartResponse;
  const parts: Array<{ partNumber: number; etag: string }> = [];

  try {
    for (
      let offset = 0, partNumber = 1;
      offset < file.size;
      offset += MULTIPART_UPLOAD_CHUNK_BYTES, partNumber += 1
    ) {
      const chunk = file.slice(offset, offset + MULTIPART_UPLOAD_CHUNK_BYTES);
      const chunkUrl =
        `/api/storage/upload-file?action=multipart-part&key=${encodeURIComponent(
          key,
        )}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`;
      const partResponse = await uploadChunkViaAppServer(
        chunkUrl,
        chunk,
        offset,
        file.size,
        onProgress,
      );
      parts.push({ partNumber: partResponse.partNumber, etag: partResponse.etag });
      if (onProgress) {
        const uploadedBytes = Math.min(file.size, offset + chunk.size);
        onProgress(Math.round((uploadedBytes / file.size) * 100));
      }
    }

    const completeResponse = await fetch(
      `/api/storage/upload-file?action=multipart-complete&key=${encodeURIComponent(
        key,
      )}&uploadId=${encodeURIComponent(uploadId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parts }),
      },
    );
    if (!completeResponse.ok) {
      throw new Error(
        `Multipart upload failed to complete with status ${completeResponse.status}`,
      );
    }
  } catch (error) {
    await fetch(
      `/api/storage/upload-file?action=multipart-abort&key=${encodeURIComponent(
        key,
      )}&uploadId=${encodeURIComponent(uploadId)}`,
      {
        method: "POST",
      },
    ).catch(() => undefined);
    throw error;
  }
}

export function useUploadFile(api: UploadApi) {
  const generateUploadUrl = useAction(api.generateUploadUrl);
  const syncMetadata = useAction(api.syncMetadata);

  return useCallback(
    async (file: File, options?: UploadOptions) => {
      const { key } = await generateUploadUrl({});
      if (file.size > MULTIPART_UPLOAD_THRESHOLD_BYTES) {
        await uploadMultipartViaAppServerWithProgress(
          key,
          file,
          options?.onProgress,
        );
      } else {
        await uploadViaAppServerWithProgress(key, file, options?.onProgress);
      }
      await syncMetadata({ key });
      return key;
    },
    [generateUploadUrl, syncMetadata],
  );
}
