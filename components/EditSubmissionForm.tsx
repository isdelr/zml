"use client";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
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
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as mm from "music-metadata-browser";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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

const editFormSchema = z
  .object({
    submissionType: z.enum(["file", "link"]),
    songTitle: z.string().min(1, { message: "Title is required." }),
    artist: z.string().min(1, { message: "Artist is required." }),
    comment: z.string().optional(),
    albumArtFile: z.instanceof(File).optional(),
    songFile: z.instanceof(File).optional(),
    songLink: z.string().optional(),
    duration: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.submissionType === "link") {
      if (!data.songLink || data.songLink.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A YouTube link is required.",
          path: ["songLink"],
        });
      } else if (
        !data.songLink.includes("youtube.com") &&
        !data.songLink.includes("youtu.be")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide a valid YouTube link.",
          path: ["songLink"],
        });
      }
    }
  });

type FormValues = z.infer<typeof editFormSchema>;
type DuplicateWarning = Awaited<ReturnType<typeof api.submissions.checkForPotentialDuplicates>>;
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
  const editSong = useMutation(api.submissions.editSong);
  const getSongMetadataFromLink = useAction(
    api.submissions.getSongMetadataFromLink,
  );
  const checkForDuplicates = useMutation(api.submissions.checkForPotentialDuplicates);
  const round = useQuery(api.rounds.getRoundMetadata, { roundId: submission.roundId });

  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });

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
    data: DuplicateWarning | null;
    valuesToSubmit: FormValues | null;
  }>({ isOpen: false, data: null, valuesToSubmit: null });

  // New: Track link metadata fetching state with debounce
  const [isFetchingLinkMeta, setIsFetchingLinkMeta] = useState(false);
  const fetchLinkDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedLinkRef = useRef<string | null>(null);

  const initialSubmissionType =
    submission.submissionType === "file" ? "file" : "link";

  const form = useForm<FormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      submissionType: initialSubmissionType,
      songTitle: submission.songTitle,
      artist: submission.artist,
      comment: submission.comment || "",
      songLink: submission.songLink || "",
      duration: submission.duration,
    },
  });

  // Watch songLink for changes to auto-fetch metadata
  const watchedLink = form.watch("songLink");

  useEffect(() => {
    // Initialize last fetched link to avoid auto-fetching on mount
    lastFetchedLinkRef.current = submission.songLink ?? null;
  }, [submission.songLink]);

  useEffect(() => {
    if (form.getValues("submissionType") !== "link") return;
    if (!watchedLink) return;
    const link = watchedLink.trim();
    const isSupported =
      link.includes("youtube.com") || link.includes("youtu.be");
    if (!isSupported) return;

    // Avoid refetching for same link
    if (lastFetchedLinkRef.current === link) return;

    if (fetchLinkDebounce.current) {
      clearTimeout(fetchLinkDebounce.current);
    }
    fetchLinkDebounce.current = setTimeout(async () => {
      setIsFetchingLinkMeta(true);
      try {
        const metadata = await getSongMetadataFromLink({ link });
        // Update form fields with fetched metadata
        if (metadata.songTitle) {
          form.setValue("songTitle", metadata.songTitle, { shouldValidate: true });
        }
        if (metadata.artist) {
          form.setValue("artist", metadata.artist, { shouldValidate: true });
        }
        if (typeof metadata.duration === "number") {
          form.setValue("duration", metadata.duration);
        }
        lastFetchedLinkRef.current = link;
      } catch (error) {
        // Silent fail; user can still proceed
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

  const handleFinalSubmit = async (values: FormValues) => {
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

        let songFileKey: string | undefined = undefined;
        if (values.songFile && values.songFile.size > 0) {
          songFileKey = await uploadFile(values.songFile);
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
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      toast.error(`Update failed: ${errorMessage}`, { id: toastId });
    }
  };

  async function onSubmit(values: FormValues) {
    const toastId = toast.loading("Checking for duplicates...");
    try {
      if (!round) {
        toast.error("Could not find the current round.", { id: toastId });
        return;
      }
      const duplicates = await checkForDuplicates({
        leagueId: submission.leagueId,
        songTitle: values.songTitle,
        artist: values.artist,
        currentSubmissionId: submission._id,
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
        error instanceof Error ? error.message : "An unknown error occurred.";
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
      <AlertDialog open={warningState.isOpen} onOpenChange={(isOpen) => setWarningState(prev => ({ ...prev, isOpen }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potential Duplicate Submission</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {warningState.data?.songExists && (
                <p>
                  A song with a similar title,{" "}
                  <strong>&quot;{warningState.data.songExists.title}&quot;</strong> by{" "}
                  <strong>{warningState.data.songExists.artist}</strong>, was already
                  submitted in the &quot;{warningState.data.songExists.roundTitle}&quot; round.
                </p>
              )}
              {warningState.data?.artistExists && (
                <p>
                  An artist named <strong>{warningState.data.artistExists.artist}</strong> has already
                  been submitted in this league (song:{" "}
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

      <div className="rounded-lg bg-card p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="songTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Song Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Tabs
              defaultValue={initialSubmissionType}
              className="w-full"
              onValueChange={handleTabChange}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">File Upload</TabsTrigger>
                <TabsTrigger value="link">YouTube Link</TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="mt-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="albumArtFile"
                    render={({ field: { onChange, ...rest } }) => (
                      <FormItem>
                        <FormLabel>Album Art (Optional)</FormLabel>
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
                                onChange(undefined);
                                if (albumArtPreview)
                                  URL.revokeObjectURL(albumArtPreview);
                                setAlbumArtPreview(null);
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
                                Upload new
                              </span>
                              <Input
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    onChange(file);
                                    const newPreviewUrl =
                                      URL.createObjectURL(file);
                                    if (albumArtPreview)
                                      URL.revokeObjectURL(albumArtPreview);
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
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    render={({ field: { onChange, value, ...rest } }) => (
                      <FormItem>
                        <FormLabel>Song File (Optional)</FormLabel>
                        <FormControl>
                          <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                            <FileAudio className="size-8" />
                            <span className="text-center text-sm font-medium">
                              {songFileName
                                ? "Upload to replace"
                                : "Upload new audio"}
                            </span>
                            <Input
                              type="file"
                              className="sr-only"
                              accept="audio/*,.flac"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                onChange(file);
                                setSongFileName(file.name);
                                try {
                                  const metadata = await mm.parseBlob(file);
                                  toast.success("Successfully read song metadata!");
                                  if (metadata.format.duration) {
                                    form.setValue("duration", Math.round(metadata.format.duration));
                                  }
                                  if (metadata.common.title) {
                                    form.setValue("songTitle", metadata.common.title, { shouldValidate: true });
                                  }
                                  if (metadata.common.artist) {
                                    form.setValue("artist", metadata.common.artist, { shouldValidate: true });
                                  }
                                  const picture = metadata.common.picture?.[0];
                                  if (picture) {
                                    try {
                                      const ext = picture.format?.split("/")?.[1] || "jpg";
                                      const artFile = new File(
                                        [picture.data],
                                        `cover.${ext}`,
                                        { type: picture.format || "image/jpeg" },
                                      );
                                      form.setValue("albumArtFile", artFile, { shouldValidate: true });
                                      const newPreviewUrl = URL.createObjectURL(artFile);
                                      if (albumArtPreview) URL.revokeObjectURL(albumArtPreview);
                                      setAlbumArtPreview(newPreviewUrl);
                                    } catch {
                                      // If creating File fails (old browsers), skip silently
                                    }
                                  }
                                } catch {
                                  toast.info("Could not extract metadata from file.");
                                }
                              }}
                              {...rest}
                            />
                          </label>
                        </FormControl>
                        {songFileName && (
                          <FormDescription className="flex items-center gap-2 pt-2">
                            <Music className="size-4" />
                            {songFileName}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            placeholder="https://www.youtube.com/watch?v=..."
                            {...field}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2">
                            {isFetchingLinkMeta ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <FaYoutube className="text-red-500" />
                            )}
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Paste the link to the song you want to submit. We&apos;ll
                        fetch the details automatically as you update it.
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
                    <Textarea placeholder="Update your comment..." {...field} />
                  </FormControl>
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
              Update Submission
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}