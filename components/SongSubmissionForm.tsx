"use client";

import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileAudio, ImagePlus, Loader2, Music, X } from "lucide-react";
import { useUploadFile } from "@convex-dev/r2/react";
import { useState } from "react";
import Image from "next/image";
import * as mm from "music-metadata-browser";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaYoutube } from "react-icons/fa";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_SONG_SIZE_MB = 150;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_SONG_SIZE_BYTES = MAX_SONG_SIZE_MB * 1024 * 1024;

const formSchema = z
  .object({
    submissionType: z.enum(["manual", "link"]),
    songTitle: z.string().optional(),
    artist: z.string().optional(),
    albumArtFile: z
      .instanceof(File)
      .optional()
      .refine(
        (file) => !file || file.size <= MAX_IMAGE_SIZE_BYTES,
        `Max image size is ${MAX_IMAGE_SIZE_MB}MB.`,
      ),
    songFile: z
      .instanceof(File)
      .optional()
      .refine(
        (file) => !file || file.size <= MAX_SONG_SIZE_BYTES,
        `Max song size is ${MAX_SONG_SIZE_MB}MB.`,
      ),
    songLink: z.string().optional(),
    comment: z.string().optional(),
    duration: z.number().optional(),
  })
  .refine(
    (data) => {
      if (data.submissionType === "manual") {
        return (
          data.songTitle &&
          data.artist &&
          data.albumArtFile?.size &&
          data.songFile?.size
        );
      }
      if (data.submissionType === "link") {
        return (
          data.songLink &&
          (data.songLink.includes("youtube.com") ||
            data.songLink.includes("youtu.be"))
        );
      }
      return false;
    },
    {
      message:
        "Please complete the required fields for your chosen submission type.",
      path: ["submissionType"],
    },
  );

type FormValues = z.infer<typeof formSchema>;
type DuplicateWarning = Awaited<ReturnType<typeof api.submissions.checkForPotentialDuplicates>>;

interface SongSubmissionFormProps {
  roundId: Id<"rounds">;
  isPresubmit?: boolean;
}

export function SongSubmissionForm({ roundId, isPresubmit = false }: SongSubmissionFormProps) {
  const submitSong = useMutation(api.submissions.submitSong);
  const presubmitSong = useMutation(api.submissions.presubmitSong);
  const getSongMetadataFromLink = useAction(api.submissions.getSongMetadataFromLink);
  const checkForDuplicates = useMutation(api.submissions.checkForPotentialDuplicates);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });

  const round = useQuery(api.rounds.get, { roundId });

  const [albumArtPreview, setAlbumArtPreview] = useState<string>("");
  const [warningState, setWarningState] = useState<{
    isOpen: boolean;
    data: DuplicateWarning | null;
    valuesToSubmit: FormValues | null;
  }>({ isOpen: false, data: null, valuesToSubmit: null });


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      submissionType: "manual",
      songTitle: "",
      artist: "",
      songLink: "",
      comment: "",
    },
  });

  const handleFinalSubmit = async (values: FormValues) => {
    const toastId = toast.loading(
      isPresubmit ? "Queuing your presubmission..." : "Submitting your masterpiece...",
    );
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
          uploadFile(values.songFile),
        ]);

        const payload = {
          roundId,
          submissionType: "file" as const,
          songTitle: values.songTitle,
          artist: values.artist,
          albumArtKey,
          songFileKey,
          comment: values.comment,
          duration: values.duration,
        };

        if (isPresubmit) {
          await presubmitSong(payload);
        } else {
          await submitSong(payload);
        }
      } else if (values.submissionType === "link" && values.songLink) {
        const metadata = await getSongMetadataFromLink({ link: values.songLink });

        const payload = {
          roundId,
          submissionType: metadata.submissionType,
          songTitle: metadata.songTitle,
          artist: metadata.artist,
          songLink: values.songLink,
          albumArtUrlValue: metadata.albumArtUrl,
          comment: values.comment,
          duration: metadata.duration,
        };

        if (isPresubmit) {
          await presubmitSong(payload);
        } else {
          await submitSong(payload);
        }
      }

      toast.success(
        isPresubmit ? "Presubmission queued! It will auto-submit when the round opens." : "Song submitted successfully!",
        { id: toastId },
      );
      form.reset();
      setAlbumArtPreview("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`${isPresubmit ? "Presubmission failed" : "Submission failed"}: ${errorMessage}`, {
        id: toastId,
      });
      console.error(error);
    }
  };

  async function onSubmit(values: FormValues) {
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
        toast.error("Song title and artist are required to check for duplicates.", { id: toastId });
        return;
      }

      // Check if round data is loaded
      if (!round) {
        toast.error("Could not find the current round.", { id: toastId });
        return;
      }

      const duplicates = await checkForDuplicates({
        leagueId: round.leagueId,
        songTitle: title,
        artist: artist,
      });

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
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Error: ${errorMessage}`, { id: toastId });
    }
  }

  // Show loading state while round data is being fetched
  if (round === undefined) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading round information...
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={warningState.isOpen} onOpenChange={(isOpen) => setWarningState(prev => ({ ...prev, isOpen }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potential Duplicate Submission</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {warningState.data?.songExists && (
                <p>
                  A song with a similar title,{' '}
                  <strong>&quot;{warningState.data.songExists.title}&quot;</strong> by{' '}
                  <strong>{warningState.data.songExists.artist}</strong>, was already
                  submitted in the &quot;{warningState.data.songExists.roundTitle}&quot; round.
                </p>
              )}
              {warningState.data?.artistExists && (
                <p>
                  An artist named <strong>{warningState.data.artistExists.artist}</strong> has already
                  been submitted in this league (song:{' '}
                  <strong>&quot;{warningState.data.artistExists.title}&quot;</strong>).
                </p>
              )}
              <p className="pt-2">Are you sure you want to submit this song?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWarningState({ isOpen: false, data: null, valuesToSubmit: null })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (warningState.valuesToSubmit) {
                handleFinalSubmit(warningState.valuesToSubmit);
              }
              setWarningState({ isOpen: false, data: null, valuesToSubmit: null });
            }}>
              Submit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-bold">
          {isPresubmit ? "Presubmit Your Track" : "Submit Your Track"}
        </h2>
        <p className="mb-6 text-muted-foreground">
          {isPresubmit
            ? "Queue your track now. It will be automatically submitted when this round opens."
            : "Choose your submission method."}
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
              <TabsContent value="manual" className="mt-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="songTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Song Title</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Bohemian Rhapsody"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="artist"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Artist</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Queen" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="albumArtFile"
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      render={({ field: { onChange, value, ...rest } }) => (
                        <FormItem>
                          <FormLabel>Album Art</FormLabel>
                          {albumArtPreview ? (
                            <div className="relative">
                              <Image
                                src={albumArtPreview}
                                alt="Album art preview"
                                width={192}
                                height={192}
                                className="aspect-square w-48 rounded-md object-cover"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute -right-2 -top-2 z-10 size-6 rounded-full"
                                onClick={() => {
                                  form.setValue("albumArtFile", undefined);
                                  URL.revokeObjectURL(albumArtPreview);
                                  setAlbumArtPreview("");
                                }}
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <FormControl>
                              <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                                <ImagePlus className="size-8" />
                                <span className="text-sm font-medium">
                                  Click to upload image
                                </span>
                                <Input
                                  type="file"
                                  style={{ top: 0, left: 0 }}
                                  className="sr-only"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > MAX_IMAGE_SIZE_BYTES) {
                                        toast.error(
                                          `Image is too large. Max size: ${MAX_IMAGE_SIZE_MB}MB.`,
                                        );
                                        return;
                                      }
                                      onChange(file);
                                      const newPreviewUrl =
                                        URL.createObjectURL(file);
                                      if (albumArtPreview) {
                                        URL.revokeObjectURL(albumArtPreview);
                                      }
                                      setAlbumArtPreview(newPreviewUrl);
                                    }
                                  }}
                                  {...rest}
                                />
                              </label>
                            </FormControl>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="songFile"
                      render={({ field: { onChange, value, ...rest } }) => (
                        <FormItem>
                          <FormLabel>Song File</FormLabel>
                          <FormControl>
                            <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                              <FileAudio className="size-8" />
                              <span className="text-sm font-medium text-center">
                                {value?.name && value.size > 0
                                  ? "File selected"
                                  : "Click to upload audio"}
                              </span>
                              <Input
                                type="file"
                                style={{ top: 0, left: 0 }}
                                className="sr-only"
                                accept="audio/*,.flac"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;

                                  if (file.size > MAX_SONG_SIZE_BYTES) {
                                    toast.error(
                                      `Song file is too large. Max size: ${MAX_SONG_SIZE_MB}MB.`,
                                    );
                                    form.setValue("songFile", undefined);
                                    e.target.value = "";
                                    return;
                                  }

                                  onChange(file);

                                  try {
                                    const metadata = await mm.parseBlob(file);
                                    toast.success(
                                      "Successfully read song metadata!",
                                    );

                                    if (metadata.format.duration) {
                                      form.setValue(
                                        "duration",
                                        Math.round(metadata.format.duration),
                                      );
                                    }

                                    if (metadata.common.title) {
                                      form.setValue(
                                        "songTitle",
                                        metadata.common.title,
                                        { shouldValidate: true },
                                      );
                                    }
                                    if (metadata.common.artist) {
                                      form.setValue(
                                        "artist",
                                        metadata.common.artist,
                                        {
                                          shouldValidate: true,
                                        },
                                      );
                                    }

                                    const picture = metadata.common.picture?.[0];
                                    if (picture) {
                                      const artFile = new File(
                                        [picture.data],
                                        `cover.${picture.format.split("/")[1]}`,
                                        { type: picture.format },
                                      );

                                      if (artFile.size <= MAX_IMAGE_SIZE_BYTES) {
                                        form.setValue("albumArtFile", artFile, {
                                          shouldValidate: true,
                                        });
                                        const newPreviewUrl =
                                          URL.createObjectURL(artFile);
                                        if (albumArtPreview)
                                          URL.revokeObjectURL(albumArtPreview);
                                        setAlbumArtPreview(newPreviewUrl);
                                      } else {
                                        toast.warning(
                                          "Embedded album art is too large, please upload manually.",
                                        );
                                      }
                                    }
                                  } catch (error) {
                                    toast.info(
                                      "Could not read metadata from this file. Please enter details manually.",
                                    );
                                    console.warn(
                                      "Metadata parsing error:",
                                      error,
                                    );
                                  }
                                }}
                                {...rest}
                              />
                            </label>
                          </FormControl>
                          {value?.name && value.size > 0 && (
                            <FormDescription className="flex items-center gap-2 pt-2">
                              <Music className="size-4" />
                              <span className="truncate">{value.name}</span>
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="link" className="mt-6">
                <FormField
                  control={form.control}
                  name="songLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YouTube Link</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="https://www.youtube.com/watch?v=8OcKBa9QYaI"
                            {...field}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2">
                            <FaYoutube className="text-red-500" />
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Paste the link to the song you want to {isPresubmit ? "presubmit" : "submit"}. We&apos;ll fetch
                        the details automatically.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        isPresubmit
                          ? "Add a comment that will appear with your song when it auto-submits..."
                          : "Add a little comment about your song..."
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This comment will be shown anonymously alongside your song
                    during the voting phase.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
              size="lg"
            >
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {isPresubmit ? "Presubmit Song" : "Submit Song"}
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}