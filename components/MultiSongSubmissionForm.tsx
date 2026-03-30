"use client";

import { useAction, useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/convex/api";
import type { SongLinkMetadata } from "@/lib/convex/types";
import { Doc } from "@/convex/_generated/dataModel";
import { useUploadFile } from "@/lib/storage/useUploadFile";
import { useUploadSubmissionSongFile } from "@/lib/storage/useUploadSubmissionSongFile";
import { createSubmissionCollectionId } from "@/lib/submission/collection";
import {
  createDefaultMultiTrack,
  defaultMultiSongSubmissionFormValues,
  multiSongSubmissionFormSchema,
  type MultiSongSubmissionFormInput,
  type MultiSongSubmissionFormOutput,
} from "@/lib/submission/multi-form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadProgressStatus } from "@/components/submission/UploadProgressStatus";
import {
  YouTubeRegionRestrictionDialog,
  type YouTubeRegionRestrictionDialogItem,
} from "@/components/submission/YouTubeRegionRestrictionDialog";
import { MultiLinkTracksSection } from "@/components/submission/multi/MultiLinkTracksSection";
import { MultiManualTracksSection } from "@/components/submission/multi/MultiManualTracksSection";
import type { MultiTrackPreviews } from "@/components/submission/multi/types";
import { toErrorMessage } from "@/lib/errors";
import { YouTubeIcon } from "@/components/icons/BrandIcons";

interface MultiSongSubmissionFormProps {
  round: Doc<"rounds">;
  maxSongs: number;
  currentCount: number;
  willAutoStartVotingOnLinkSubmit?: boolean;
}

type PendingMultiSongSubmission = {
  values: MultiSongSubmissionFormOutput;
  metadata: Array<SongLinkMetadata | null>;
};

export function MultiSongSubmissionForm({
  round,
  maxSongs,
  currentCount,
  willAutoStartVotingOnLinkSubmit = false,
}: MultiSongSubmissionFormProps) {
  const roundId = round._id;
  const submitSong = useMutation(api.submissions.submitSong);
  const getSongMetadataFromLink = useAction(
    api.submissions.getSongMetadataFromLink,
  );
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });
  const uploadSubmissionSongFile = useUploadSubmissionSongFile();

  const [trackPreviews, setTrackPreviews] = useState<MultiTrackPreviews>({});
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    title: string;
    description?: string;
  } | null>(null);
  const [regionWarningState, setRegionWarningState] = useState<{
    isOpen: boolean;
    items: YouTubeRegionRestrictionDialogItem[];
    pendingSubmission: PendingMultiSongSubmission | null;
  }>({ isOpen: false, items: [], pendingSubmission: null });

  const form = useForm<
    MultiSongSubmissionFormInput,
    unknown,
    MultiSongSubmissionFormOutput
  >({
    resolver: zodResolver(multiSongSubmissionFormSchema),
    defaultValues: defaultMultiSongSubmissionFormValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tracks",
  });
  const submissionType = form.watch("submissionType");

  const remainingSongs = maxSongs - currentCount;

  const handleFinalSubmit = async (
    values: MultiSongSubmissionFormOutput,
    prefetchedMetadata?: Array<SongLinkMetadata | null>,
  ) => {
    setIsSubmitting(true);
    const toastId = toast.loading(
      `Submitting ${values.tracks.length} song(s)...`,
    );

    try {
      const totalTracks = values.tracks.length;
      const collectionId = createSubmissionCollectionId(roundId);

      if (values.submissionType === "manual") {
        for (const [i, track] of values.tracks.entries()) {
          if (!track.songFile || !track.albumArtFile) continue;

          setUploadStatus({
            title: `Uploading track ${i + 1} of ${totalTracks}`,
            description:
              "Uploading the file now. We will finish getting it ready after the upload ends.",
          });
          setUploadProgress(Math.round(((i + 0.5) / totalTracks) * 100));

          const [albumArtKey, songFileKey] = await Promise.all([
            uploadFile(track.albumArtFile),
            uploadSubmissionSongFile(track.songFile),
          ]);

          await submitSong({
            roundId,
            submissionType: "file",
            songTitle: track.songTitle,
            artist: track.artist,
            albumArtKey,
            songFileKey,
            duration: track.duration,
            comment: track.comment,
            collectionId,
            collectionType: "multi",
            collectionTotalTracks: values.tracks.length,
          });

          setUploadStatus({
            title: `Uploaded track ${i + 1} of ${totalTracks}`,
            description:
              "That track is uploaded. You do not need to keep the page open after the rest finish uploading.",
          });
          setUploadProgress(Math.round(((i + 1) / totalTracks) * 100));
        }
      } else if (values.submissionType === "link") {
        for (const [i, track] of values.tracks.entries()) {
          if (!track.songLink) continue;

          setUploadProgress(Math.round(((i + 0.5) / totalTracks) * 100));

          const metadata =
            prefetchedMetadata?.[i] ??
            (await getSongMetadataFromLink({ link: track.songLink }));

          await submitSong({
            roundId,
            submissionType: metadata.submissionType,
            songTitle: track.songTitle || metadata.songTitle,
            artist: track.artist || metadata.artist,
            songLink: track.songLink,
            albumArtUrlValue: metadata.albumArtUrl ?? undefined,
            duration: metadata.duration,
            comment: track.comment,
            collectionId,
            collectionType: "multi",
            collectionTotalTracks: values.tracks.length,
          });

          setUploadProgress(Math.round(((i + 1) / totalTracks) * 100));
        }
      }

      toast.success(
        values.submissionType === "manual"
          ? `Uploaded ${values.tracks.length} song(s). We are getting them ready in the background.`
          : `Successfully submitted ${values.tracks.length} song(s)!`,
        {
          id: toastId,
        },
      );
      form.reset(defaultMultiSongSubmissionFormValues);
      setTrackPreviews({});
      setUploadProgress(0);
      setUploadStatus(null);
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      toast.error(`Submission failed: ${errorMessage}`, { id: toastId });
      console.error(error);
      setUploadStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueWithRegionRestrictions = async (
    pendingSubmission: PendingMultiSongSubmission,
  ) => {
    const items = pendingSubmission.metadata.flatMap((metadata, index) => {
      const blockedRegions = metadata?.regionRestriction?.blockedRegions ?? [];
      if (blockedRegions.length === 0) {
        return [];
      }

      const track = pendingSubmission.values.tracks[index];
      return [
        {
          label: `Track ${index + 1}`,
          songTitle: track?.songTitle || metadata?.songTitle || "Unknown title",
          artist: track?.artist || metadata?.artist || "Unknown artist",
          blockedRegions,
        },
      ];
    });

    if (items.length > 0) {
      setRegionWarningState({
        isOpen: true,
        items,
        pendingSubmission,
      });
      return;
    }

    await handleFinalSubmit(
      pendingSubmission.values,
      pendingSubmission.metadata,
    );
  };

  async function onSubmit(values: MultiSongSubmissionFormOutput) {
    if (values.tracks.length > remainingSongs) {
      toast.error(`You can only submit ${remainingSongs} more song(s)`);
      return;
    }

    if (values.submissionType === "link") {
      const metadata = await Promise.all(
        values.tracks.map((track) =>
          track.songLink
            ? getSongMetadataFromLink({ link: track.songLink })
            : Promise.resolve(null),
        ),
      );

      await continueWithRegionRestrictions({ values, metadata });
      return;
    }

    await handleFinalSubmit(values);
  }

  const handleAddTrack = () => {
    if (fields.length >= remainingSongs) {
      toast.error(`You can only add ${remainingSongs} song(s) total`);
      return;
    }
    append(createDefaultMultiTrack());
  };

  const handleRemoveTrack = (index: number) => {
    remove(index);
  };

  return (
    <>
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
      />

      <div className="rounded-lg border bg-card p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Submit Your Songs</h2>
          <p className="text-muted-foreground">
            You can submit up to {remainingSongs} more song
            {remainingSongs !== 1 ? "s" : ""} for this round.
          </p>
          {round.submissionInstructions ? (
            <p className="mt-2 text-sm italic text-muted-foreground">
              {round.submissionInstructions}
            </p>
          ) : null}
        </div>

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
                <TabsTrigger value="manual">
                  <Upload className="mr-2 size-4" />
                  File Upload
                </TabsTrigger>
                <TabsTrigger value="link">
                  <YouTubeIcon className="mr-2 size-4" />
                  YouTube Links
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="mt-6 space-y-4">
                <MultiManualTracksSection
                  form={form}
                  fields={fields}
                  remainingSongs={remainingSongs}
                  trackPreviews={trackPreviews}
                  setTrackPreviews={setTrackPreviews}
                  onAddTrack={handleAddTrack}
                  onRemoveTrack={handleRemoveTrack}
                />
              </TabsContent>

              <TabsContent value="link" className="mt-6 space-y-4">
                <MultiLinkTracksSection
                  form={form}
                  fields={fields}
                  remainingSongs={remainingSongs}
                  onAddTrack={handleAddTrack}
                  onRemoveTrack={handleRemoveTrack}
                />
              </TabsContent>
            </Tabs>

            <UploadProgressStatus
              isVisible={isSubmitting && uploadProgress > 0}
              title={uploadStatus?.title ?? "Uploading songs"}
              description={uploadStatus?.description}
              progress={uploadProgress}
            />

            {submissionType === "link" && willAutoStartVotingOnLinkSubmit ? (
              <Alert className="border-warning/50 bg-warning/10 text-warning">
                <AlertTitle>This submission starts voting</AlertTitle>
                <AlertDescription className="text-warning/90">
                  This collection completes the round, so voting will begin
                  immediately after you submit it.
                </AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || fields.length === 0}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {submissionType === "manual"
                    ? `Uploading... ${uploadProgress}%`
                    : `Submitting... ${uploadProgress}%`}
                </>
              ) : (
                <>
                  {submissionType === "manual" ? "Upload" : "Submit"}{" "}
                  {fields.length} Song
                  {fields.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}
