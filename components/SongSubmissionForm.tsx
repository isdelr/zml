"use client";

import { useAction, useConvex, useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PotentialDuplicateDialog } from "@/components/submission/PotentialDuplicateDialog";
import { SongManualTab } from "@/components/submission/song/SongManualTab";
import { SongLinkTab } from "@/components/submission/song/SongLinkTab";
import { SongCommentField } from "@/components/submission/song/SongCommentField";
import { toErrorMessage } from "@/lib/errors";

interface SongSubmissionFormProps {
  round: Doc<"rounds">;
}

export function SongSubmissionForm({ round }: SongSubmissionFormProps) {
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
  const [warningState, setWarningState] = useState<{
    isOpen: boolean;
    data: DuplicateSubmissionWarning | null;
    valuesToSubmit: SongSubmissionFormValues | null;
  }>({ isOpen: false, data: null, valuesToSubmit: null });

  const form = useForm<SongSubmissionFormValues>({
    resolver: zodResolver(songSubmissionFormSchema),
    defaultValues: defaultSongSubmissionFormValues,
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
        const [albumArtKey, songFileKey] = await Promise.all([
          uploadFile(values.albumArtFile),
          uploadSubmissionSongFile(values.songFile),
        ]);

        await submitSong({
          roundId,
          submissionType: "file",
          songTitle: values.songTitle,
          artist: values.artist,
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
          songLink: values.songLink,
          albumArtUrlValue: metadata.albumArtUrl,
          comment: values.comment,
          duration: metadata.duration,
        });
      }

      toast.success("Song submitted successfully!", { id: toastId });
      form.reset(defaultSongSubmissionFormValues);
      setAlbumArtPreview("");
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      toast.error(`Submission failed: ${errorMessage}`, { id: toastId });
      console.error(error);
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

            <SongCommentField form={form} />

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
              size="lg"
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Submit Song
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}
