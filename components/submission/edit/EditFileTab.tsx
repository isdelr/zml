"use client";

import Image from "next/image";
import { UseFormReturn } from "react-hook-form";
import { FileAudio, ImagePlus, Music, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import {
  AUDIO_UPLOAD_ACCEPT,
  SUPPORTED_AUDIO_UPLOAD_FORMATS_LABEL,
} from "@/lib/submission/audio-file-types";
import { parseAudioFileMetadata } from "@/lib/submission/metadata";
import type { EditSubmissionFormValues } from "@/lib/submission/edit-form";

interface EditFileTabProps {
  form: UseFormReturn<EditSubmissionFormValues>;
  albumArtPreview: string | null;
  setAlbumArtPreview: (value: string | null) => void;
  songFileName: string | null;
  setSongFileName: (value: string | null) => void;
}

export function EditFileTab({
  form,
  albumArtPreview,
  setAlbumArtPreview,
  songFileName,
  setSongFileName,
}: EditFileTabProps) {
  return (
    <TabsContent value="file" className="mt-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormField
          control={form.control}
          name="albumArtFile"
          render={({ field }) => {
            const { onChange, value, ...rest } = field;
            void value;
            return (
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
                        if (albumArtPreview) {
                          URL.revokeObjectURL(albumArtPreview);
                        }
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
            );
          }}
        />

        <FormField
          control={form.control}
          name="songFile"
          render={({ field: { onChange, value, ...rest } }) => {
            void value;
            return (
              <FormItem>
                <FormLabel>Song File (Optional)</FormLabel>
                <FormControl>
                  <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                    <FileAudio className="size-8" />
                    <span className="text-center text-sm font-medium">
                      {songFileName ? "Upload to replace" : "Upload new audio"}
                    </span>
                    <Input
                      type="file"
                      className="sr-only"
                      accept={AUDIO_UPLOAD_ACCEPT}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        onChange(file);
                        setSongFileName(file.name);
                        try {
                          const metadata = await parseAudioFileMetadata(file);
                          toast.success("Successfully read song metadata!");
                          if (metadata.durationSeconds) {
                            form.setValue("duration", metadata.durationSeconds);
                          }
                          if (metadata.title) {
                            form.setValue("songTitle", metadata.title, {
                              shouldValidate: true,
                            });
                          }
                          if (metadata.artist) {
                            form.setValue("artist", metadata.artist, {
                              shouldValidate: true,
                            });
                          }
                          if (metadata.coverArtFile) {
                            form.setValue(
                              "albumArtFile",
                              metadata.coverArtFile,
                              {
                                shouldValidate: true,
                              },
                            );
                            const newPreviewUrl = URL.createObjectURL(
                              metadata.coverArtFile,
                            );
                            if (albumArtPreview) {
                              URL.revokeObjectURL(albumArtPreview);
                            }
                            setAlbumArtPreview(newPreviewUrl);
                          }
                        } catch {
                          toast.info("Could not extract metadata from file.");
                        }
                      }}
                      {...rest}
                    />
                  </label>
                </FormControl>
                {songFileName ? (
                  <FormDescription className="flex items-center gap-2 pt-2">
                    <Music className="size-4" />
                    {songFileName}
                  </FormDescription>
                ) : null}
                <FormDescription>
                  Supported formats: {SUPPORTED_AUDIO_UPLOAD_FORMATS_LABEL}
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>
    </TabsContent>
  );
}
