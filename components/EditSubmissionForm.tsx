"use client";

import { useAction, useConvex, useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/convex/api";
import type { DuplicateSubmissionWarning } from "@/lib/convex/types";
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
import { EditBasicsFields } from "@/components/submission/edit/EditBasicsFields";
import { EditCommentField } from "@/components/submission/edit/EditCommentField";
import { EditFileTab } from "@/components/submission/edit/EditFileTab";
import { EditLinkTab } from "@/components/submission/edit/EditLinkTab";
import { toErrorMessage } from "@/lib/errors";

type SubmissionFull = Doc<"submissions"> & {
  albumArtUrl: string | null;
  songFileUrl: string | null;
};

interface EditSubmissionFormProps {
  submission: SubmissionFull;
  onSubmitted: () => void;
}

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
    valuesToSubmit: EditSubmissionFormValues | null;
  }>({ isOpen: false, data: null, valuesToSubmit: null });

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

  const handleFinalSubmit = async (values: EditSubmissionFormValues) => {
    const toastId = toast.loading("Updating your submission...");
    try {
      if (values.submissionType === "link") {
        if (!values.songLink) throw new Error("Link is missing.");

        const metadata = await getSongMetadataFromLink({
          link: values.songLink,
        });
        await editSong({
          submissionId: submission._id,
          songTitle: values.songTitle,
          artist: values.artist,
          comment: values.comment,
          submissionType: metadata.submissionType,
          songLink: values.songLink,
          albumArtUrlValue: metadata.albumArtUrl,
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
          songFileKey = await uploadSubmissionSongFile(values.songFile);
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

      toast.success("Submission updated successfully!", { id: toastId });
      onSubmitted();
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      toast.error(`Update failed: ${errorMessage}`, { id: toastId });
    }
  };

  async function onSubmit(values: EditSubmissionFormValues) {
    const toastId = toast.loading("Checking for duplicates...");
    try {
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
          valuesToSubmit: values,
        });
        toast.dismiss(toastId);
      } else {
        toast.dismiss(toastId);
        await handleFinalSubmit(values);
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
          setWarningState({ isOpen: false, data: null, valuesToSubmit: null })
        }
        onConfirm={() => {
          if (warningState.valuesToSubmit) {
            handleFinalSubmit(warningState.valuesToSubmit);
          }
          setWarningState({ isOpen: false, data: null, valuesToSubmit: null });
        }}
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
