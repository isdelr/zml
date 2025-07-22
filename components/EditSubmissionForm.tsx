"use client";

import { useAction, useMutation } from "convex/react";
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
import { useState } from "react";
import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { FaSpotify, FaYoutube } from "react-icons/fa";

const editFormSchema = z
  .object({
    submissionType: z.enum(["file", "link"]),
    songTitle: z.string().min(1, { message: "Title is required." }),
    artist: z.string().min(1, { message: "Artist is required." }),
    comment: z.string().optional(),
    albumArtFile: z.instanceof(File).optional(),
    songFile: z.instanceof(File).optional(),
    songLink: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.submissionType === "link") {
      if (!data.songLink || data.songLink.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A Spotify or YouTube link is required.",
          path: ["songLink"],
        });
      } else if (
        !data.songLink.includes("spotify.com") &&
        !data.songLink.includes("youtube.com") &&
        !data.songLink.includes("youtu.be")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide a valid Spotify or YouTube link.",
          path: ["songLink"],
        });
      }
    }
  });

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

  const initialSubmissionType =
    submission.submissionType === "file" ? "file" : "link";

  const form = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      submissionType: initialSubmissionType,
      songTitle: submission.songTitle,
      artist: submission.artist,
      comment: submission.comment || "",
      songLink: submission.songLink || "",
    },
  });

  async function onSubmit(values: z.infer<typeof editFormSchema>) {
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
          albumArtKey: null,
          songFileKey: null,
        });
      } else {
        // submissionType is 'file'
        let albumArtKey: string | undefined | null = undefined; // undefined means no change
        if (values.albumArtFile && values.albumArtFile.size > 0) {
          albumArtKey = await uploadFile(values.albumArtFile);
        } else if (albumArtPreview === null && submission.albumArtKey) {
          albumArtKey = null; // User explicitly removed the image
        }
        let songFileKey: string | undefined = undefined; // undefined means no change
        if (values.songFile && values.songFile.size > 0) {
          songFileKey = await uploadFile(values.songFile);
        }
        const isAlbumArtMissing = albumArtKey === null || (!albumArtKey && !submission.albumArtKey);
        const isSongFileMissing = !songFileKey && !submission.songFileKey;
        if (isAlbumArtMissing || isSongFileMissing) {
          toast.error("An album art and song file are required for file submissions.", { id: toastId });
          return;
        }
        const patchPayload: Parameters<typeof editSong>[0] = {
          submissionId: submission._id,
          songTitle: values.songTitle,
          artist: values.artist,
          comment: values.comment,
          submissionType: "file",
          songLink: null,
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
      console.error(error);
    }
  }

  const handleTabChange = (value: string) => {
    form.setValue("submissionType", value as "file" | "link");
    if (value === "link" && !form.getValues("songLink") && submission.songLink) {
      form.setValue("songLink", submission.songLink);
    }
  };

  return (
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
              <TabsTrigger value="link">Spotify/YouTube Link</TabsTrigger>
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
                    <FormLabel>Spotify or YouTube Link</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="https://open.spotify.com/track/..."
                          {...field}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2">
                          <FaSpotify className="text-green-500" />
                          <FaYoutube className="text-red-500" />
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Paste the link to the song you want to submit. We&apos;ll
                      fetch the details automatically.
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
  );
}