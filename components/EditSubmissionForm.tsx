"use client";

import { useMutation } from "convex/react";
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

const MAX_IMAGE_SIZE_MB = 5;
const MAX_SONG_SIZE_MB = 200;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_SONG_SIZE_BYTES = MAX_SONG_SIZE_MB * 1024 * 1024;

const editFormSchema = z.object({
  songTitle: z.string().min(1, { message: "Title is required." }),
  artist: z.string().min(1, { message: "Artist is required." }),
  albumArtFile: z
    .instanceof(File)
    .optional()
    .refine(
      (file) => !file || file.size <= MAX_IMAGE_SIZE_BYTES,
      `Album art must be less than ${MAX_IMAGE_SIZE_MB}MB.`,
    )
    .refine(
      (file) => !file || file.type.startsWith("image/"),
      "Album art must be an image file.",
    ),
  songFile: z
    .instanceof(File)
    .optional()
    .refine(
      (file) => !file || file.size <= MAX_SONG_SIZE_BYTES,
      `Song file must be less than ${MAX_SONG_SIZE_MB}MB.`,
    )
    .refine(
      (file) => !file || file.type.startsWith("audio/"),
      "Please upload a valid audio file.",
    ),
  comment: z.string().optional(),
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
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });

  const [albumArtPreview, setAlbumArtPreview] = useState<string | null>(
    submission.albumArtUrl,
  );
  const [songFileName, setSongFileName] = useState<string | null>(
    "Current song file saved. Upload to replace.",
  );

  const form = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      songTitle: submission.songTitle,
      artist: submission.artist,
      comment: submission.comment || "",
    },
  });

  async function onSubmit(values: z.infer<typeof editFormSchema>) {
    const toastId = toast.loading("Updating your submission...");
    try {
      let albumArtKey: string | undefined = undefined;
      if (values.albumArtFile && values.albumArtFile.size > 0) {
        albumArtKey = await uploadFile(values.albumArtFile);
      }

      let songFileKey: string | undefined = undefined;
      if (values.songFile && values.songFile.size > 0) {
        songFileKey = await uploadFile(values.songFile);
      }

      await editSong({
        submissionId: submission._id,
        songTitle: values.songTitle,
        artist: values.artist,
        albumArtKey: albumArtKey,
        songFileKey: songFileKey,
        comment: values.comment,
      });

      toast.success("Submission updated successfully!", { id: toastId });
      onSubmitted();
    } catch (error) {
      toast.error("Failed to update submission.", { id: toastId });
      console.error(error);
    }
  }

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
                        <span className="text-sm font-medium">Upload new</span>
                        <Input
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              onChange(file);
                              const newPreviewUrl = URL.createObjectURL(file);
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
              render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                  <FormLabel>Song File (Optional)</FormLabel>
                  <FormControl>
                    <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                      <FileAudio className="size-8" />
                      <span className="text-center text-sm font-medium">
                        {songFileName
                          ? "Upload to replace"
                          : "Click to upload audio"}
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
          <FormField
            control={form.control}
            name="comment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comment (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Update your comment..."
                    {...field}
                  />
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