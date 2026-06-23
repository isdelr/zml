"use client";

import Image from "next/image";
import { useId, useRef } from "react";
import { UseFormReturn } from "react-hook-form";
import { FileAudio, ImagePlus, Loader2, Music, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface SongManualTabProps {
  form: UseFormReturn<SongSubmissionFormValues>;
  albumArtPreview: string;
  setAlbumArtPreview: (value: string) => void;
  detailsUnlocked: boolean;
  isMetadataReading: boolean;
  onMetadataReadStart: () => void;
  onMetadataReadComplete: () => void;
  onMetadataReadReset: () => void;
}

export function SongManualTab({
  form,
  albumArtPreview,
  setAlbumArtPreview,
  detailsUnlocked,
  isMetadataReading,
  onMetadataReadStart,
  onMetadataReadComplete,
  onMetadataReadReset,
}: SongManualTabProps) {
  const albumArtInputId = useId();
  const albumArtInputRef = useRef<HTMLInputElement>(null);
  const albumArtDisabled = !detailsUnlocked;

  const revokePreviewUrl = (previewUrl: string) => {
    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  return (
    <TabsContent value="manual" className="mt-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormField
          control={form.control}
          name="songFile"
          render={({ field: { onChange, value, ...rest } }) => (
            <FormItem>
              <FormLabel>Song File</FormLabel>
              <FormControl>
                <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                  {isMetadataReading ? (
                    <Loader2 className="size-8 animate-spin" />
                  ) : (
                    <FileAudio className="size-8" />
                  )}
                  <span className="text-center text-sm font-medium">
                    {isMetadataReading
                      ? "Reading metadata"
                      : value?.name && value.size > 0
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
                        onMetadataReadReset();
                        e.target.value = "";
                        return;
                      }

                      onChange(file);
                      onMetadataReadStart();

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
                        if (metadata.album) {
                          form.setValue("albumName", metadata.album, {
                            shouldValidate: true,
                          });
                        }
                        if (typeof metadata.year === "number") {
                          form.setValue("year", metadata.year);
                        }

                        if (metadata.coverArtFile) {
                          form.setValue("albumArtFile", metadata.coverArtFile, {
                            shouldValidate: true,
                          });
                          const newPreviewUrl = URL.createObjectURL(
                            metadata.coverArtFile,
                          );
                          if (albumArtPreview) {
                            revokePreviewUrl(albumArtPreview);
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
                      } finally {
                        onMetadataReadComplete();
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

        <FormField
          control={form.control}
          name="albumArtFile"
          render={({ field: { onChange, value, ref, ...rest } }) => {
            void value;
            return (
              <FormItem
                className={cn(
                  "transition-opacity",
                  albumArtDisabled && "opacity-55",
                )}
              >
                <FormLabel>Album Art</FormLabel>
                <FormControl>
                  <div className="space-y-3">
                    <Input
                      id={albumArtInputId}
                      ref={(node) => {
                        albumArtInputRef.current = node;
                        ref(node);
                      }}
                      type="file"
                      style={{ top: 0, left: 0 }}
                      className="sr-only"
                      accept="image/*"
                      disabled={albumArtDisabled}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > MAX_IMAGE_SIZE_BYTES) {
                            toast.error(
                              `Image is too large. Max size: ${MAX_IMAGE_SIZE_MB}MB.`,
                            );
                            e.target.value = "";
                            return;
                          }
                          onChange(file);
                          const newPreviewUrl = URL.createObjectURL(file);
                          if (albumArtPreview) {
                            revokePreviewUrl(albumArtPreview);
                          }
                          setAlbumArtPreview(newPreviewUrl);
                        }
                      }}
                      {...rest}
                    />

                    {albumArtPreview ? (
                      <>
                        <div className="relative w-fit">
                          <label
                            htmlFor={
                              albumArtDisabled ? undefined : albumArtInputId
                            }
                            className={cn(
                              "block",
                              albumArtDisabled
                                ? "cursor-not-allowed"
                                : "cursor-pointer",
                            )}
                          >
                            <Image
                              src={albumArtPreview}
                              alt="Album art preview"
                              width={192}
                              height={192}
                              className="aspect-square w-48 rounded-md object-cover"
                            />
                            <div
                              className={cn(
                                "absolute inset-0 flex items-end rounded-md bg-black/45 p-3 text-sm font-medium text-white transition-opacity",
                                albumArtDisabled
                                  ? "opacity-0"
                                  : "opacity-0 hover:opacity-100",
                              )}
                            >
                              Change image
                            </div>
                          </label>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -right-2 -top-2 z-10 size-6 rounded-full"
                            disabled={albumArtDisabled}
                            onClick={() => {
                              form.setValue("albumArtFile", undefined, {
                                shouldValidate: true,
                              });
                              revokePreviewUrl(albumArtPreview);
                              setAlbumArtPreview("");
                              if (albumArtInputRef.current) {
                                albumArtInputRef.current.value = "";
                              }
                            }}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          disabled={albumArtDisabled}
                          asChild={!albumArtDisabled}
                        >
                          {albumArtDisabled ? (
                            <span>Change image</span>
                          ) : (
                            <label
                              htmlFor={albumArtInputId}
                              className="cursor-pointer"
                            >
                              Change image
                            </label>
                          )}
                        </Button>
                      </>
                    ) : (
                      <label
                        htmlFor={albumArtDisabled ? undefined : albumArtInputId}
                        aria-disabled={albumArtDisabled}
                        className={cn(
                          "flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground",
                          albumArtDisabled
                            ? "cursor-not-allowed bg-muted/40 text-muted-foreground/60"
                            : "cursor-pointer hover:border-primary hover:text-primary",
                        )}
                      >
                        <ImagePlus className="size-8" />
                        <span className="text-center text-sm font-medium">
                          Click to upload image
                        </span>
                      </label>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>
    </TabsContent>
  );
}
