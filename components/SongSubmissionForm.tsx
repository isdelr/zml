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
  defaultSongSubmissionFormValues,
  songSubmissionFormSchema,
  type SongSubmissionFormValues,
} from "@/lib/submission/song-form";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PotentialDuplicateDialog } from "@/components/submission/PotentialDuplicateDialog";
import {
  YouTubeRegionRestrictionDialog,
  type YouTubeRegionRestrictionDialogItem,
} from "@/components/submission/YouTubeRegionRestrictionDialog";
import { SongManualTab } from "@/components/submission/song/SongManualTab";
import { SongLinkTab } from "@/components/submission/song/SongLinkTab";
import { SongDetailsFields } from "@/components/submission/song/SongDetailsFields";
import { SongCommentField } from "@/components/submission/song/SongCommentField";
import { UploadProgressStatus } from "@/components/submission/UploadProgressStatus";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toErrorMessage } from "@/lib/errors";
import { extractYouTubeVideoId } from "@/lib/youtube";

interface SongSubmissionFormProps {
  round: Doc<"rounds">;
  willAutoStartVotingOnLinkSubmit?: boolean;
}

type PendingSongSubmission = {
  values: SongSubmissionFormValues;
  metadata: SongLinkMetadata | null;
};

type MetadataReadState = "idle" | "reading" | "ready";

export function SongSubmissionForm({
  round,
  willAutoStartVotingOnLinkSubmit = false,
}: SongSubmissionFormProps) {
  const roundId = round._id;
  const convex = useConvex();
  const submitSong = useMutation(api.submissions.submitSong);
  const getSongMetadataFromLink = useAction(
    api.submissions.getSongMetadataFromLink,
  );
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });
  const uploadSubmissionSongFile = useUploadSubmissionSongFile();

  const [albumArtPreview, setAlbumArtPreview] = useState<string>("");
  const [manualMetadataState, setManualMetadataState] =
    useState<MetadataReadState>("idle");
  const [linkMetadataState, setLinkMetadataState] =
    useState<MetadataReadState>("idle");
  const [isFetchingLinkMeta, setIsFetchingLinkMeta] = useState(false);
  const [linkAlbumArtPreview, setLinkAlbumArtPreview] = useState<string | null>(
    null,
  );
  const fetchLinkDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedLinkRef = useRef<string | null>(null);
  const linkMetadataRef = useRef<SongLinkMetadata | null>(null);
  const [uploadState, setUploadState] = useState<{
    title: string;
    description?: string;
    progress?: number | null;
  } | null>(null);
  const [warningState, setWarningState] = useState<{
    isOpen: boolean;
    data: DuplicateSubmissionWarning | null;
    pendingSubmission: PendingSongSubmission | null;
  }>({ isOpen: false, data: null, pendingSubmission: null });
  const [regionWarningState, setRegionWarningState] = useState<{
    isOpen: boolean;
    items: YouTubeRegionRestrictionDialogItem[];
    pendingSubmission: PendingSongSubmission | null;
  }>({ isOpen: false, items: [], pendingSubmission: null });

  const form = useForm<SongSubmissionFormValues>({
    resolver: zodResolver(songSubmissionFormSchema),
    defaultValues: defaultSongSubmissionFormValues,
  });
  const submissionType = useWatch({
    control: form.control,
    name: "submissionType",
  });
  const watchedLink = useWatch({
    control: form.control,
    name: "songLink",
  });

  const detailsDisabled =
    submissionType === "manual"
      ? manualMetadataState !== "ready"
      : linkMetadataState !== "ready";

  useEffect(() => {
    if (submissionType !== "link") {
      return;
    }

    const link = watchedLink?.trim() ?? "";
    const videoId = extractYouTubeVideoId(link);

    if (!videoId) {
      if (fetchLinkDebounce.current) {
        clearTimeout(fetchLinkDebounce.current);
      }
      linkMetadataRef.current = null;
      setLinkMetadataState("idle");
      setLinkAlbumArtPreview(null);
      setIsFetchingLinkMeta(false);
      return;
    }

    if (lastFetchedLinkRef.current === link && linkMetadataRef.current) {
      setLinkMetadataState("ready");
      setLinkAlbumArtPreview(linkMetadataRef.current.albumArtUrl ?? null);
      return;
    }

    if (fetchLinkDebounce.current) {
      clearTimeout(fetchLinkDebounce.current);
    }

    linkMetadataRef.current = null;
    setLinkAlbumArtPreview(null);
    setLinkMetadataState("reading");

    fetchLinkDebounce.current = setTimeout(async () => {
      setIsFetchingLinkMeta(true);
      try {
        const metadata = await getSongMetadataFromLink({ link });
        const currentLink = form.getValues("songLink")?.trim() ?? "";
        if (
          currentLink !== link ||
          form.getValues("submissionType") !== "link"
        ) {
          return;
        }

        linkMetadataRef.current = metadata;
        lastFetchedLinkRef.current = link;
        setLinkAlbumArtPreview(metadata.albumArtUrl ?? null);
        setLinkMetadataState("ready");

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
      } catch (error) {
        const currentLink = form.getValues("songLink")?.trim() ?? "";
        if (currentLink === link) {
          linkMetadataRef.current = null;
          setLinkMetadataState("idle");
          setLinkAlbumArtPreview(null);
          toast.error("Could not fetch YouTube details from that link.");
        }
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
  }, [watchedLink, submissionType, form, getSongMetadataFromLink]);

  const getMetadataForLink = async (link: string) => {
    const trimmedLink = link.trim();
    if (lastFetchedLinkRef.current === trimmedLink && linkMetadataRef.current) {
      return linkMetadataRef.current;
    }

    const metadata = await getSongMetadataFromLink({ link: trimmedLink });
    lastFetchedLinkRef.current = trimmedLink;
    linkMetadataRef.current = metadata;
    setLinkAlbumArtPreview(metadata.albumArtUrl ?? null);
    setLinkMetadataState("ready");
    return metadata;
  };

  const resetMetadataState = () => {
    setManualMetadataState("idle");
    setLinkMetadataState("idle");
    setIsFetchingLinkMeta(false);
    setLinkAlbumArtPreview(null);
    lastFetchedLinkRef.current = null;
    linkMetadataRef.current = null;
    if (fetchLinkDebounce.current) {
      clearTimeout(fetchLinkDebounce.current);
    }
  };

  const handleFinalSubmit = async (
    values: SongSubmissionFormValues,
    metadataOverride?: SongLinkMetadata | null,
  ) => {
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
        const metadata =
          metadataOverride ?? (await getMetadataForLink(values.songLink));

        await submitSong({
          roundId,
          submissionType: metadata.submissionType,
          songTitle: values.songTitle?.trim() || metadata.songTitle,
          artist: values.artist?.trim() || metadata.artist,
          albumName: values.albumName?.trim() || undefined,
          year: values.year,
          songLink: values.songLink.trim(),
          albumArtUrlValue: metadata.albumArtUrl ?? undefined,
          comment: values.comment,
          duration: values.duration ?? metadata.duration,
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
      resetMetadataState();
      setUploadState(null);
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      toast.error(`Submission failed: ${errorMessage}`, { id: toastId });
      console.error(error);
      setUploadState(null);
    }
  };

  const continueWithRegionRestrictions = async (
    pendingSubmission: PendingSongSubmission,
  ) => {
    const blockedRegions =
      pendingSubmission.metadata?.regionRestriction?.blockedRegions ?? [];

    if (blockedRegions.length > 0) {
      setRegionWarningState({
        isOpen: true,
        items: [
          {
            songTitle: pendingSubmission.metadata?.songTitle ?? "Unknown title",
            artist: pendingSubmission.metadata?.artist ?? "Unknown artist",
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

  async function onSubmit(values: SongSubmissionFormValues) {
    const toastId = toast.loading("Checking submission...");
    try {
      let title = "";
      let artist = "";
      let metadata: SongLinkMetadata | null = null;

      if (values.submissionType === "manual") {
        title = values.songTitle || "";
        artist = values.artist || "";
      } else if (values.songLink) {
        metadata = await getMetadataForLink(values.songLink);
        title = values.songTitle?.trim() || metadata.songTitle;
        artist = values.artist?.trim() || metadata.artist;
      }

      if (!title || !artist) {
        toast.error(
          "Song title and artist are required to check for duplicates.",
          {
            id: toastId,
          },
        );
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
          pendingSubmission: {
            values: { ...values, songTitle: title, artist },
            metadata,
          },
        });
        toast.dismiss(toastId);
      } else {
        toast.dismiss(toastId);
        await continueWithRegionRestrictions({
          values: { ...values, songTitle: title, artist },
          metadata,
        });
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
      />

      <div className="mx-auto w-full max-w-xl rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-bold">Submit Your Track</h2>
        <p className="mb-6 text-muted-foreground">
          Choose your submission method.
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
                <TabsTrigger value="link">YouTube</TabsTrigger>
              </TabsList>

              <SongManualTab
                form={form}
                albumArtPreview={albumArtPreview}
                setAlbumArtPreview={setAlbumArtPreview}
                detailsUnlocked={manualMetadataState === "ready"}
                isMetadataReading={manualMetadataState === "reading"}
                onMetadataReadStart={() => setManualMetadataState("reading")}
                onMetadataReadComplete={() => setManualMetadataState("ready")}
                onMetadataReadReset={() => setManualMetadataState("idle")}
              />
              <SongLinkTab
                form={form}
                albumArtPreview={linkAlbumArtPreview}
                detailsUnlocked={linkMetadataState === "ready"}
                isFetchingLinkMeta={isFetchingLinkMeta}
              />
            </Tabs>

            <SongDetailsFields form={form} disabled={detailsDisabled} />

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
