"use client";

import { useAction, useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { api } from "@/lib/convex/api";
import { Doc } from "@/convex/_generated/dataModel";
import { useUploadFile } from "@/lib/storage/useUploadFile";
import { useUploadSubmissionSongFile } from "@/lib/storage/useUploadSubmissionSongFile";
import { createSubmissionCollectionId } from "@/lib/submission/collection";
import {
  albumSubmissionFormSchema,
  createDefaultAlbumTrack,
  defaultAlbumSubmissionFormValues,
  type AlbumSubmissionFormInput,
  type AlbumSubmissionFormOutput,
} from "@/lib/submission/album-form";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlbumArtUploadField } from "@/components/submission/album/AlbumArtUploadField";
import { AlbumLinkTracksSection } from "@/components/submission/album/AlbumLinkTracksSection";
import { AlbumManualTracksSection } from "@/components/submission/album/AlbumManualTracksSection";
import { AlbumNameArtistFields } from "@/components/submission/album/AlbumNameArtistFields";
import { AlbumNotesField } from "@/components/submission/album/AlbumNotesField";
import { AlbumReleaseYearField } from "@/components/submission/album/AlbumReleaseYearField";
import { UploadProgressStatus } from "@/components/submission/UploadProgressStatus";
import { toErrorMessage } from "@/lib/errors";

interface AlbumSubmissionFormProps {
  round: Doc<"rounds">;
}

export function AlbumSubmissionForm({ round }: AlbumSubmissionFormProps) {
  const roundId = round._id;
  const submitSong = useMutation(api.submissions.submitSong);
  const getSongMetadataFromLink = useAction(api.submissions.getSongMetadataFromLink);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });
  const uploadSubmissionSongFile = useUploadSubmissionSongFile();

  const [albumArtPreview, setAlbumArtPreview] =
    useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AlbumSubmissionFormInput, unknown, AlbumSubmissionFormOutput>({
    resolver: zodResolver(albumSubmissionFormSchema),
    defaultValues: defaultAlbumSubmissionFormValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tracks",
  });

  const handleFinalSubmit = async (values: AlbumSubmissionFormOutput) => {
    setIsSubmitting(true);
    const toastId = toast.loading(
      `Submitting album with ${values.tracks.length} tracks...`,
    );

    try {
      const collectionId = createSubmissionCollectionId(roundId);
      const totalTracks = values.tracks.length;

      if (values.submissionType === "manual" && values.albumArtFile) {
        setUploadProgress(5);
        const albumArtKey = await uploadFile(values.albumArtFile);
        setUploadProgress(10);

        for (const [i, track] of values.tracks.entries()) {
          if (!track.songFile) continue;

          const trackProgress = 10 + Math.round(((i + 0.5) / totalTracks) * 90);
          setUploadProgress(trackProgress);

          const songFileKey = await uploadSubmissionSongFile(track.songFile);

          await submitSong({
            roundId,
            submissionType: "file",
            songTitle: track.songTitle,
            artist: track.artist || values.albumArtist,
            albumArtKey,
            songFileKey,
            duration: track.duration,
            comment: undefined,
            collectionId,
            collectionType: "album",
            collectionName: values.albumName,
            collectionArtist: values.albumArtist,
            collectionReleaseYear: values.releaseYear,
            collectionNotes: values.albumNotes,
            collectionTotalTracks: values.tracks.length,
            trackNumber: track.trackNumber,
          });

          const completedProgress =
            10 + Math.round(((i + 1) / totalTracks) * 90);
          setUploadProgress(completedProgress);
        }
      } else if (values.submissionType === "link") {
        for (const [i, track] of values.tracks.entries()) {
          if (!track.songLink) continue;

          const trackProgress = Math.round(((i + 0.5) / totalTracks) * 100);
          setUploadProgress(trackProgress);

          const metadata = await getSongMetadataFromLink({ link: track.songLink });

          await submitSong({
            roundId,
            submissionType: metadata.submissionType,
            songTitle: track.songTitle || metadata.songTitle,
            artist: track.artist || values.albumArtist,
            songLink: track.songLink,
            albumArtUrlValue: metadata.albumArtUrl,
            duration: metadata.duration,
            comment: undefined,
            collectionId,
            collectionType: "album",
            collectionName: values.albumName,
            collectionArtist: values.albumArtist,
            collectionReleaseYear: values.releaseYear,
            collectionNotes: values.albumNotes,
            collectionTotalTracks: values.tracks.length,
            trackNumber: track.trackNumber,
          });

          const completedProgress = Math.round(((i + 1) / totalTracks) * 100);
          setUploadProgress(completedProgress);
        }
      }

      setUploadProgress(100);
      toast.success(
        `Album with ${values.tracks.length} track(s) submitted successfully!`,
        { id: toastId },
      );
      form.reset(defaultAlbumSubmissionFormValues);
      setAlbumArtPreview("");
      setUploadProgress(0);
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      toast.error(`Submission failed: ${errorMessage}`, { id: toastId });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  async function onSubmit(values: AlbumSubmissionFormOutput) {
    await handleFinalSubmit(values);
  }

  const albumConfig = round.albumConfig;
  const minTracks = albumConfig?.minTracks;
  const maxTracks = albumConfig?.maxTracks;
  const requireReleaseYear = Boolean(albumConfig?.requireReleaseYear);

  const handleAddTrack = () => {
    const maxAllowed = maxTracks || 50;
    if (fields.length >= maxAllowed) {
      toast.error(`Maximum ${maxAllowed} tracks allowed`);
      return;
    }
    append(createDefaultAlbumTrack(fields.length + 1));
  };

  const handleRemoveTrack = (index: number) => {
    const minRequired = minTracks || 1;
    if (fields.length <= minRequired) {
      toast.error(`At least ${minRequired} track(s) required`);
      return;
    }
    remove(index);
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-2xl font-bold">Submit Your Album</h2>
      <p className="mb-6 text-muted-foreground">
        Upload multiple tracks as an album submission.
        {minTracks && maxTracks && ` (${minTracks}-${maxTracks} tracks required)`}
        {minTracks && !maxTracks && ` (at least ${minTracks} tracks required)`}
        {!minTracks && maxTracks && ` (up to ${maxTracks} tracks)`}
      </p>

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
              <TabsTrigger value="link">YouTube Links</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-6 space-y-6">
              <AlbumNameArtistFields form={form} />

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {requireReleaseYear ? <AlbumReleaseYearField form={form} /> : null}
                <AlbumArtUploadField
                  form={form}
                  albumArtPreview={albumArtPreview}
                  setAlbumArtPreview={setAlbumArtPreview}
                />
              </div>

              <AlbumNotesField form={form} />

              <AlbumManualTracksSection
                form={form}
                fields={fields}
                onAddTrack={handleAddTrack}
                onRemoveTrack={handleRemoveTrack}
                albumArtPreview={albumArtPreview}
                setAlbumArtPreview={setAlbumArtPreview}
              />
            </TabsContent>

            <TabsContent value="link" className="mt-6 space-y-6">
              <AlbumNameArtistFields form={form} />
              {requireReleaseYear ? <AlbumReleaseYearField form={form} /> : null}
              <AlbumNotesField form={form} />
              <AlbumLinkTracksSection
                form={form}
                fields={fields}
                onAddTrack={handleAddTrack}
                onRemoveTrack={handleRemoveTrack}
              />
            </TabsContent>
          </Tabs>

          <UploadProgressStatus progress={uploadProgress} isSubmitting={isSubmitting} />

          <Button type="submit" className="w-full" disabled={isSubmitting} size="lg">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Uploading... {uploadProgress}%
              </>
            ) : (
              <>Submit Album ({fields.length} track{fields.length !== 1 ? "s" : ""})</>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
