"use client";

import { useAction, useConvex, useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/convex/api";
import type { DuplicateSubmissionWarning } from "@/lib/convex/types";
import { Doc } from "@/convex/_generated/dataModel";
import { useUploadFile } from "@/lib/storage/useUploadFile";
import { useUploadSubmissionSongFile } from "@/lib/storage/useUploadSubmissionSongFile";
import {
  defaultSongSubmissionFormValues,
  songSubmissionFormSchema,
  type SongSubmissionFormValues,
} from "@/lib/submission/song-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PotentialDuplicateDialog } from "@/components/submission/PotentialDuplicateDialog";
import { SongManualTab } from "@/components/submission/song/SongManualTab";
import { SongLinkTab } from "@/components/submission/song/SongLinkTab";
import { SongCommentField } from "@/components/submission/song/SongCommentField";
import { UploadProgressStatus } from "@/components/submission/UploadProgressStatus";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toErrorMessage } from "@/lib/errors";

interface SongSubmissionFormProps {
  round: Doc<"rounds">;
  willAutoStartVotingOnLinkSubmit?: boolean;
}

export function SongSubmissionForm({
  round,
  willAutoStartVotingOnLinkSubmit = false,
}: SongSubmissionFormProps) {
  const roundId = round._id;
  const convex = useConvex();
  const submitSong = useMutation(api.submissions.submitSong);
  const getSongMetadataFromLink = useAction(api.submissions.getSongMetadataFromLink);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });
  const uploadSubmissionSongFile = useUploadSubmissionSongFile();

  const [albumArtPreview, setAlbumArtPreview] = useState<string>("");
  const [uploadState, setUploadState] = useState<{
    title: string;
    description?: string;
    progress?: number | null;
  } | null>(null);
  const [warningState, setWarningState] = useState<{
    isOpen: boolean;
    data: DuplicateSubmissionWarning | null;
    valuesToSubmit: SongSubmissionFormValues | null;
  }>({ isOpen: false, data: null, valuesToSubmit: null });

  const form = useForm<SongSubmissionFormValues>({
    resolver: zodResolver(songSubmissionFormSchema),
    defaultValues: defaultSongSubmissionFormValues,
  });
  const submissionType = useWatch({
    control: form.control,
    name: "submissionType",
  });

  const handleFinalSubmit = async (values: SongSubmissionFormValues) => {
    const toastId = toast.loading("Submitting your masterpiece...");
    try {
      if (
        values.submissionType === "manual" &&
        values.songTitle &&
        values.artist &&
        values.albumArtFile &&
        values.songFile
      ) {
        setUploadState({
          title: "Uploading song",
          description:
            "Uploading your file now. We will finish getting it ready after the upload ends.",
          progress: 0,
        });
        const [albumArtKey, songFileKey] = await Promise.all([
          uploadFile(values.albumArtFile),
          uploadSubmissionSongFile(values.songFile, {
            onProgress: (progress) =>
              setUploadState({
                title: "Uploading song",
                description:
                  "Uploading your file now. We will finish getting it ready after the upload ends.",
                progress,
              }),
          }),
        ]);

        setUploadState({
          title: "Upload complete",
          description:
            "Your file is uploaded. You can close the browser while we finish getting it ready in the background.",
          progress: null,
        });
        await submitSong({
          roundId,
          submissionType: "file",
          songTitle: values.songTitle,
          artist: values.artist,
          albumName: values.albumName || undefined,
          year: values.year,
          albumArtKey,
          songFileKey,
          comment: values.comment,
          duration: values.duration,
        });
      } else if (values.submissionType === "link" && values.songLink) {
        const metadata = await getSongMetadataFromLink({ link: values.songLink });

        await submitSong({
          roundId,
          submissionType: metadata.submissionType,
          songTitle: metadata.songTitle,
          artist: metadata.artist,
          albumName: undefined,
          year: values.year,
          songLink: values.songLink,
          albumArtUrlValue: metadata.albumArtUrl,
          comment: values.comment,
          duration: metadata.duration,
        });
      }

      toast.success(
        values.submissionType === "manual"
          ? "Song uploaded. We are getting it ready in the background."
          : "Song submitted successfully!",
        { id: toastId },
      );
      form.reset(defaultSongSubmissionFormValues);
      setAlbumArtPreview("");
      setUploadState(null);
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      toast.error(`Submission failed: ${errorMessage}`, { id: toastId });
      console.error(error);
      setUploadState(null);
    }
  };

  async function onSubmit(values: SongSubmissionFormValues) {
    const toastId = toast.loading("Checking submission...");
    try {
      let title = "";
      let artist = "";

      if (values.submissionType === "manual") {
        title = values.songTitle || "";
        artist = values.artist || "";
      } else if (values.songLink) {
        const metadata = await getSongMetadataFromLink({ link: values.songLink });
        title = metadata.songTitle;
        artist = metadata.artist;
      }

      if (!title || !artist) {
        toast.error("Song title and artist are required to check for duplicates.", {
          id: toastId,
        });
        return;
      }

      const duplicates = await convex.query(
        api.submissions.checkForPotentialDuplicates,
        {
          leagueId: round.leagueId,
          songTitle: title,
          artist,
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

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-bold">Submit Your Track</h2>
        <p className="mb-6 text-muted-foreground">Choose your submission method.</p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs
              defaultValue="manual"
              className="w-full"
              onValueChange={(value) =>
                form.setValue("submissionType", value as "manual" | "link")
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Upload</TabsTrigger>
                <TabsTrigger value="link">YouTube</TabsTrigger>
              </TabsList>

              <SongManualTab
                form={form}
                albumArtPreview={albumArtPreview}
                setAlbumArtPreview={setAlbumArtPreview}
              />
              <SongLinkTab form={form} />
            </Tabs>

            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Release Year</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 1997"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={typeof field.value === "number" ? field.value : ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? undefined : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SongCommentField form={form} />

            {submissionType === "link" && willAutoStartVotingOnLinkSubmit ? (
              <Alert className="border-warning/50 bg-warning/10 text-warning">
                <AlertTitle>This submission starts voting</AlertTitle>
                <AlertDescription className="text-warning/90">
                  This is the final required submission for the round, so voting
                  will begin immediately after you submit it.
                </AlertDescription>
              </Alert>
            ) : null}

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
              {form.formState.isSubmitting
                ? submissionType === "manual"
                  ? "Uploading Song"
                  : "Submitting Song"
                : submissionType === "manual"
                  ? "Upload Song"
                  : "Submit Song"}
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}
