"use client";

import { api } from "@/lib/convex/api";
import { useUploadFile } from "@/lib/storage/useUploadFile";

export function useUploadSubmissionSongFile() {
  return useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });
}
