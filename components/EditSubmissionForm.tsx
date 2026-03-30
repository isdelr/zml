"use client";

import { useAction, useConvex, useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/convex/api";
import type {
  DuplicateSubmissionWarning,
  SongLinkMetadata,
} from "@/lib/convex/types";
import { Doc } from "@/convex/_generated/dataModel";
import { useUploadFile } from "@/lib/storage/useUploadFile";
import { useUploadSubmissionSongFile } from "@/lib/storage/useUploadSubmissionSongFile";
import {
  editSubmissionFormSchema,
  type EditSubmissionFormValues,
} from "@/lib/submission/edit-form";
import { isYouTubeLink } from "@/lib/youtube";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PotentialDuplicateDialog } from "@/components/submission/PotentialDuplicateDialog";
import {
  YouTubeRegionRestrictionDialog,
  type YouTubeRegionRestrictionDialogItem,
} from "@/components/submission/YouTubeRegionRestrictionDialog";
import { EditBasicsFields } from "@/components/submission/edit/EditBasicsFields";
import { EditCommentField } from "@/components/submission/edit/EditCommentField";
import { EditFileTab } from "@/components/submission/edit/EditFileTab";
import { EditLinkTab } from "@/components/submission/edit/EditLinkTab";
import { UploadProgressStatus } from "@/components/submission/UploadProgressStatus";
import { toErrorMessage } from "@/lib/errors";

type SubmissionFull = Doc<"submissions"> & {
  albumArtUrl: string | null;
  songFileUrl: string | null;
};

interface EditSubmissionFormProps {
  submission: SubmissionFull;
  onSubmitted: () => void;
}

type PendingSubmissionEdit = {
  values: EditSubmissionFormValues;
  metadata: SongLinkMetadata | null;
};

export function EditSubmissionForm({
  submission,
  onSubmitted,
}: EditSubmissionFormProps) {
  const convex = useConvex();
  const editSong = useMutation(api.submissions.editSong);
  const getSongMetadataFromLink = useAction(
    api.submissions.getSongMetadataFromLink,
  );

  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });
  const uploadSubmissionSongFile = useUploadSubmissionSongFile();

  const [albumArtPreview, setAlbumArtPreview] = useState<string | null>(
    submission.albumArtUrl,
  );
  const [songFileName, setSongFileName] = useState<string | null>(
    submission.songFileUrl
      ? "Current song file saved. Upload to replace."
      : null,
  );
  const [warningState, setWarningState] = useState<{
    isOpen: boolean;
    data: DuplicateSubmissionWarning | null;
    pendingSubmission: PendingSubmissionEdit | null;
  }>({ isOpen: false, data: null, pendingSubmission: null });
  const [regionWarningState, setRegionWarningState] = useState<{
    isOpen: boolean;
    items: YouTubeRegionRestrictionDialogItem[];
    pendingSubmission: PendingSubmissionEdit | null;
  }>({ isOpen: false, items: [], pendingSubmission: null });
  const [uploadState, setUploadState] = useState<{
    title: string;
    description?: string;
    progress?: number | null;
  } | null>(null);

  const [isFetchingLinkMeta, setIsFetchingLinkMeta] = useState(false);
  const fetchLinkDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedLinkRef = useRef<string | null>(null);

  const initialSubmissionType =
    submission.submissionType === "file" ? "file" : "link";

  const form = useForm<EditSubmissionFormValues>({
    resolver: zodResolver(editSubmissionFormSchema),
    defaultValues: {
      submissionType: initialSubmissionType,
      songTitle: submission.songTitle,
      artist: submission.artist,
      albumName: submission.albumName || "",
      year: submission.year,
      comment: submission.comment || "",
      songLink: submission.songLink || "",
      duration: submission.duration,
    },
  });

  const watchedLink = useWatch({
    control: form.control,
    name: "songLink",
  });

  useEffect(() => {
    lastFetchedLinkRef.current = submission.songLink ?? null;
  }, [submission.songLink]);

  useEffect(() => {
    if (form.getValues("submissionType") !== "link") return;
    if (!watchedLink) return;

    const link = watchedLink.trim();
    if (!isYouTubeLink(link)) return;
    if (lastFetchedLinkRef.current === link) return;

    if (fetchLinkDebounce.current) {
      clearTimeout(fetchLinkDebounce.current);
    }

    fetchLinkDebounce.current = setTimeout(async () => {
      setIsFetchingLinkMeta(true);
      try {
        const metadata = await getSongMetadataFromLink({ link });
        if (metadata.songTitle) {
          form.setValue("songTitle", metadata.songTitle, {
            shouldValidate: true,
          });
        }
        if (metadata.artist) {
          form.setValue("artist", metadata.artist, { shouldValidate: true });
        }
        if (typeof metadata.duration === "number") {
          form.setValue("duration", metadata.duration);
        }
        lastFetchedLinkRef.current = link;
      } catch (error) {
        console.error("Failed to fetch metadata for link:", error);
      } finally {
        setIsFetchingLinkMeta(false);
      }
    }, 600);

    return () => {
      if (fetchLinkDebounce.current) {
        clearTimeout(fetchLinkDebounce.current);
      }
    };
  }, [watchedLink, form, getSongMetadataFromLink]);

  const handleFinalSubmit = async (
    values: EditSubmissionFormValues,
    metadataOverride?: SongLinkMetadata | null,
  ) => {
    const toastId = toast.loading("Updating your submission...");
    try {
      if (values.submissionType === "link") {
        if (!values.songLink) throw new Error("Link is missing.");

        const metadata =
          metadataOverride ??
          (await getSongMetadataFromLink({ link: values.songLink }));
        await editSong({
          submissionId: submission._id,
          songTitle: values.songTitle,
          artist: values.artist,
          albumName: values.albumName,
          year: values.year,
          comment: values.comment,
          submissionType: metadata.submissionType,
          songLink: values.songLink,
          albumArtUrlValue: metadata.albumArtUrl ?? undefined,
          duration: metadata.duration,
          albumArtKey: null,
          songFileKey: null,
        });
      } else {
        let albumArtKey: string | undefined | null = undefined;
        if (values.albumArtFile && values.albumArtFile.size > 0) {
          albumArtKey = await uploadFile(values.albumArtFile);
        } else if (albumArtPreview === null && submission.albumArtKey) {
          albumArtKey = null;
        }

        let songFileKey: string | undefined;
        if (values.songFile && values.songFile.size > 0) {
          setUploadState({
            title: "Uploading replacement file",
            description:
              "Uploading the new file now. We will finish getting it ready after the upload ends.",
            progress: 0,
          });
          songFileKey = await uploadSubmissionSongFile(values.songFile, {
            onProgress: (progress) =>
              setUploadState({
                title: "Uploading replacement file",
                description:
                  "Uploading the new file now. We will finish getting it ready after the upload ends.",
                progress,
              }),
          });
          setUploadState({
            title: "Upload complete",
            description:
              "The replacement file is uploaded. We will finish getting it ready in the background.",
            progress: null,
          });
        }

        const isAlbumArtMissing =
          albumArtKey === null || (!albumArtKey && !submission.albumArtKey);
        const isSongFileMissing = !songFileKey && !submission.songFileKey;

        if (isAlbumArtMissing || isSongFileMissing) {
          toast.error(
            "An album art and song file are required for file submissions.",
            { id: toastId },
          );
          return;
        }

        const patchPayload: Parameters<typeof editSong>[0] = {
          submissionId: submission._id,
          songTitle: values.songTitle,
          artist: values.artist,
          albumName: values.albumName,
          year: values.year,
          comment: values.comment,
          submissionType: "file",
          songLink: null,
          duration: values.duration,
          albumArtUrlValue: null,
        };

        if (albumArtKey !== undefined) patchPayload.albumArtKey = albumArtKey;
        if (songFileKey !== undefined) patchPayload.songFileKey = songFileKey;

        await editSong(patchPayload);
      }

      toast.success(
        values.submissionType === "file" && values.songFile
          ? "Submission updated. We are getting the new file ready in the background."
          : "Submission updated successfully!",
        { id: toastId },
      );
      setUploadState(null);
      onSubmitted();
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      toast.error(`Update failed: ${errorMessage}`, { id: toastId });
      setUploadState(null);
    }
  };

  const continueWithRegionRestrictions = async (
    pendingSubmission: PendingSubmissionEdit,
  ) => {
    const blockedRegions =
      pendingSubmission.metadata?.regionRestriction?.blockedRegions ?? [];

    if (blockedRegions.length > 0) {
      setRegionWarningState({
        isOpen: true,
        items: [
          {
            songTitle:
              pendingSubmission.values.songTitle ||
              pendingSubmission.metadata?.songTitle ||
              "Unknown title",
            artist:
              pendingSubmission.values.artist ||
              pendingSubmission.metadata?.artist ||
              "Unknown artist",
            blockedRegions,
          },
        ],
        pendingSubmission,
      });
      return;
    }

    await handleFinalSubmit(
      pendingSubmission.values,
      pendingSubmission.metadata,
    );
  };

  async function onSubmit(values: EditSubmissionFormValues) {
    const toastId = toast.loading("Checking submission...");
    try {
      let metadata: SongLinkMetadata | null = null;

      if (values.submissionType === "link") {
        if (!values.songLink) {
          throw new Error("Link is missing.");
        }
        metadata = await getSongMetadataFromLink({ link: values.songLink });
      }

      const duplicates = await convex.query(
        api.submissions.checkForPotentialDuplicates,
        {
          leagueId: submission.leagueId,
          songTitle: values.songTitle,
          artist: values.artist,
          currentSubmissionId: submission._id,
        },
      );

      if (duplicates.songExists || duplicates.artistExists) {
        setWarningState({
          isOpen: true,
          data: duplicates,
          pendingSubmission: { values, metadata },
        });
        toast.dismiss(toastId);
      } else {
        toast.dismiss(toastId);
        await continueWithRegionRestrictions({ values, metadata });
      }
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      toast.error(`Error: ${errorMessage}`, { id: toastId });
    }
  }

  const handleTabChange = (value: string) => {
    form.setValue("submissionType", value as "file" | "link");
    if (
      value === "link" &&
      !form.getValues("songLink") &&
      submission.songLink
    ) {
      form.setValue("songLink", submission.songLink);
    }
  };

  return (
    <>
      <PotentialDuplicateDialog
        open={warningState.isOpen}
        data={warningState.data}
        onOpenChange={(isOpen) =>
          setWarningState((prev) => ({ ...prev, isOpen }))
        }
        onCancel={() =>
          setWarningState({
            isOpen: false,
            data: null,
            pendingSubmission: null,
          })
        }
        onConfirm={() => {
          const pendingSubmission = warningState.pendingSubmission;
          setWarningState({
            isOpen: false,
            data: null,
            pendingSubmission: null,
          });
          if (pendingSubmission) {
            void continueWithRegionRestrictions(pendingSubmission);
          }
        }}
      />
      <YouTubeRegionRestrictionDialog
        open={regionWarningState.isOpen}
        items={regionWarningState.items}
        onOpenChange={(isOpen) =>
          setRegionWarningState((prev) => ({ ...prev, isOpen }))
        }
        onCancel={() =>
          setRegionWarningState({
            isOpen: false,
            items: [],
            pendingSubmission: null,
          })
        }
        onConfirm={() => {
          const pendingSubmission = regionWarningState.pendingSubmission;
          setRegionWarningState({
            isOpen: false,
            items: [],
            pendingSubmission: null,
          });
          if (pendingSubmission) {
            void handleFinalSubmit(
              pendingSubmission.values,
              pendingSubmission.metadata,
            );
          }
        }}
        confirmLabel="Save Anyway"
      />

      <div className="rounded-lg bg-card p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <EditBasicsFields form={form} />

            <Tabs
              defaultValue={initialSubmissionType}
              className="w-full"
              onValueChange={handleTabChange}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">File Upload</TabsTrigger>
                <TabsTrigger value="link">YouTube Link</TabsTrigger>
              </TabsList>

              <EditFileTab
                form={form}
                albumArtPreview={albumArtPreview}
                setAlbumArtPreview={setAlbumArtPreview}
                songFileName={songFileName}
                setSongFileName={setSongFileName}
              />
              <EditLinkTab
                form={form}
                isFetchingLinkMeta={isFetchingLinkMeta}
              />
            </Tabs>

            <EditCommentField form={form} />

            <UploadProgressStatus
              isVisible={uploadState !== null}
              title={uploadState?.title ?? ""}
              description={uploadState?.description}
              progress={uploadState?.progress}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
              size="lg"
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Update Submission
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}
