"use client";

import { useMutation, useAction } from "convex/react";
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
import { FaSpotify, FaYoutube } from "react-icons/fa";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_SONG_SIZE_MB = 150;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_SONG_SIZE_BYTES = MAX_SONG_SIZE_MB * 1024 * 1024;

const formSchema = z.object({
  submissionType: z.enum(["manual", "link"]),
  songTitle: z.string().optional(),
  artist: z.string().optional(),
  albumArtFile: z.instanceof(File).optional().refine(
    (file) => !file || file.size <= MAX_IMAGE_SIZE_BYTES,
    `Max image size is ${MAX_IMAGE_SIZE_MB}MB.`
  ),
  songFile: z.instanceof(File).optional().refine(
    (file) => !file || file.size <= MAX_SONG_SIZE_BYTES,
    `Max song size is ${MAX_SONG_SIZE_MB}MB.`
  ),
  songLink: z.string().optional(),
  comment: z.string().optional(),
}).refine(data => {
  if (data.submissionType === 'manual') {
    return data.songTitle && data.artist && data.albumArtFile?.size && data.songFile?.size;
  }
  if (data.submissionType === 'link') {
    return data.songLink && (data.songLink.includes('spotify.com') || data.songLink.includes('youtube.com') || data.songLink.includes('youtu.be'));
  }
  return false;
}, {
  message: "Please complete the required fields for your chosen submission type.",
  path: ["submissionType"],
});

interface SongSubmissionFormProps {
  roundId: Id<"rounds">;
}

export function SongSubmissionForm({ roundId }: SongSubmissionFormProps) {
  const submitSong = useMutation(api.submissions.submitSong);
  const getSongMetadataFromLink = useAction(api.submissions.getSongMetadataFromLink);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });

  const [albumArtPreview, setAlbumArtPreview] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      submissionType: "manual",
      songTitle: "",
      artist: "",
      songLink: "",
      comment: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const toastId = toast.loading("Submitting your masterpiece...");
    try {
      if (values.submissionType === 'manual' && values.songTitle && values.artist && values.albumArtFile && values.songFile) {
        const [albumArtKey, songFileKey] = await Promise.all([
          uploadFile(values.albumArtFile),
          uploadFile(values.songFile),
        ]);

        await submitSong({
          roundId,
          submissionType: 'file',
          songTitle: values.songTitle,
          artist: values.artist,
          albumArtKey,
          songFileKey,
          comment: values.comment,
        });

      } else if (values.submissionType === 'link' && values.songLink) {
        const metadata = await getSongMetadataFromLink({ link: values.songLink });

        await submitSong({
          roundId,
          submissionType: metadata.submissionType,
          songTitle: metadata.songTitle,
          artist: metadata.artist,
          songLink: values.songLink,
          albumArtUrlValue: metadata.albumArtUrl,
          comment: values.comment,
        });
      }

      toast.success("Song submitted successfully!", { id: toastId });
      form.reset();
      setAlbumArtPreview("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Submission failed: ${errorMessage}`, { id: toastId });
      console.error(error);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-2xl font-bold">Submit Your Track</h2>
      <p className="mb-6 text-muted-foreground">
        Choose your submission method.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="manual" className="w-full" onValueChange={(value) => form.setValue('submissionType', value as "manual" | "link")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual Upload</TabsTrigger>
              <TabsTrigger value="link">From Spotify/YouTube</TabsTrigger>
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
                          <Input placeholder="e.g., Bohemian Rhapsody" {...field} />
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
                                toast.error(`Image is too large. Max size: ${MAX_IMAGE_SIZE_MB}MB.`);
                                return;
                              }
                              onChange(file);
                              const newPreviewUrl = URL.createObjectURL(file);
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
                            toast.error(`Song file is too large. Max size: ${MAX_SONG_SIZE_MB}MB.`);
                            form.setValue("songFile", undefined);
                            e.target.value = ""; // Reset file input
                            return;
                          }

                          // Update the form state for the song file immediately
                          onChange(file);

                          // Now, parse metadata and autofill other fields
                          try {
                            const metadata = await mm.parseBlob(file);
                            toast.success("Successfully read song metadata!");

                            if (metadata.common.title) {
                              form.setValue(
                                "songTitle",
                                metadata.common.title,
                                { shouldValidate: true },
                              );
                            }
                            if (metadata.common.artist) {
                              form.setValue("artist", metadata.common.artist, {
                                shouldValidate: true,
                              });
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
                            console.warn("Metadata parsing error:", error);
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
                    <FormLabel>Spotify or YouTube Link</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input placeholder="https://open.spotify.com/track/..." {...field} />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2">
                          <FaSpotify className="text-green-500" />
                          <FaYoutube className="text-red-500" />
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Paste the link to the song you want to submit. We&apos;ll fetch the details automatically.
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
                    placeholder="Add a little comment about your song..."
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
            Submit Song
          </Button>
        </form>
      </Form>
    </div>
  );
}