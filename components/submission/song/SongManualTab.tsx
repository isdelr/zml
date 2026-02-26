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
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  MAX_SONG_SIZE_BYTES,
  MAX_SONG_SIZE_MB,
} from "@/lib/submission/constants";
import {
  AUDIO_UPLOAD_ACCEPT,
  SUPPORTED_AUDIO_UPLOAD_FORMATS_LABEL,
} from "@/lib/submission/audio-file-types";
import { parseAudioFileMetadata } from "@/lib/submission/metadata";
import type { SongSubmissionFormValues } from "@/lib/submission/song-form";

interface SongManualTabProps {
  form: UseFormReturn<SongSubmissionFormValues>;
  albumArtPreview: string;
  setAlbumArtPreview: (value: string) => void;
}

export function SongManualTab({
  form,
  albumArtPreview,
  setAlbumArtPreview,
}: SongManualTabProps) {
  return (
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
            render={({ field: { onChange, value, ...rest } }) => {
              void value;
              return (
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
            render={({ field: { onChange, value, ...rest } }) => (
              <FormItem>
                <FormLabel>Song File</FormLabel>
                <FormControl>
                  <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                    <FileAudio className="size-8" />
                    <span className="text-center text-sm font-medium">
                      {value?.name && value.size > 0
                        ? "File selected"
                        : "Click to upload audio"}
                    </span>
                    <Input
                      type="file"
                      style={{ top: 0, left: 0 }}
                      className="sr-only"
                      accept={AUDIO_UPLOAD_ACCEPT}
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
                          const metadata = await parseAudioFileMetadata(file, {
                            maxCoverArtSizeBytes: MAX_IMAGE_SIZE_BYTES,
                          });
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
                          } else if (metadata.coverArtTooLarge) {
                            toast.warning(
                              "Embedded album art is too large, please upload manually.",
                            );
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
                {value?.name && value.size > 0 ? (
                  <FormDescription className="flex items-center gap-2 pt-2">
                    <Music className="size-4" />
                    <span className="truncate">{value.name}</span>
                  </FormDescription>
                ) : null}
                <FormDescription>
                  Supported formats: {SUPPORTED_AUDIO_UPLOAD_FORMATS_LABEL}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </TabsContent>
  );
}
