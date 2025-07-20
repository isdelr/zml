"use client";

import { useMutation } from "convex/react";
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

const MAX_IMAGE_SIZE_MB = 5;
const MAX_SONG_SIZE_MB = 50;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_SONG_SIZE_BYTES = MAX_SONG_SIZE_MB * 1024 * 1024;

const formSchema = z
  .object({
    songTitle: z.string().min(1, { message: "Title is required." }),
    artist: z.string().min(1, { message: "Artist is required." }),
    albumArtFile: z
      .instanceof(File)
      .refine((file) => file.size > 0, "Album art file is required.")
      .refine(
        (file) => file.size <= MAX_IMAGE_SIZE_BYTES,
        `Album art must be less than ${MAX_IMAGE_SIZE_MB}MB.`,
      ),
    songFile: z
      .instanceof(File)
      .refine((file) => file.size > 0, "A song file is required.")
      .refine(
        (file) => file.size <= MAX_SONG_SIZE_BYTES,
        `Song file must be less than ${MAX_SONG_SIZE_MB}MB.`,
      ),
  })
  .refine((data) => data.albumArtFile.type.startsWith("image/"), {
    message: "Album art must be an image file.",
    path: ["albumArtFile"],
  })
  .refine((data) => data.songFile.type.startsWith("audio/"), {
    message: "Please upload a valid audio file (e.g., MP3, FLAC, WAV).",
    path: ["songFile"],
  });

interface SongSubmissionFormProps {
  roundId: Id<"rounds">;
}

export function SongSubmissionForm({ roundId }: SongSubmissionFormProps) {
  const submitSong = useMutation(api.submissions.submitSong);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });

  const [albumArtPreview, setAlbumArtPreview] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      songTitle: "",
      artist: "",
      albumArtFile: new File([], ""),
      songFile: new File([], ""),
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const toastId = toast.loading("Uploading files, please wait...", {
        description: "Your masterpiece is on its way.",
      });

      const [albumArtKey, songFileKey] = await Promise.all([
        uploadFile(values.albumArtFile),
        uploadFile(values.songFile),
      ]);

      await submitSong({
        roundId,
        songTitle: values.songTitle,
        artist: values.artist,
        albumArtKey,
        songFileKey,
      });

      toast.success("Song submitted successfully!", { id: toastId });
      form.reset();
      setAlbumArtPreview("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Submission failed: ${errorMessage}`);
      console.error(error);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-2xl font-bold">Submit Your Track</h2>
      <p className="mb-6 text-muted-foreground">
        Upload a song file, and we'll try to fill in the details for you.
      </p>
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

            <FormField
              control={form.control}
              name="albumArtFile"
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
                          form.setValue("albumArtFile", new File([], ""));
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
                      <span className="text-sm font-medium">
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
                      {value.name}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
