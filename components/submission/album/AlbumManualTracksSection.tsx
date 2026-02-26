"use client";

import { FileAudio, Music, Trash2 } from "lucide-react";
import { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_SONG_SIZE_BYTES,
  MAX_SONG_SIZE_MB,
} from "@/lib/submission/constants";
import {
  AUDIO_UPLOAD_ACCEPT,
  SUPPORTED_AUDIO_UPLOAD_FORMATS_LABEL,
} from "@/lib/submission/audio-file-types";
import { parseAudioFileMetadata } from "@/lib/submission/metadata";
import type {
  AlbumSubmissionFormInput,
  AlbumSubmissionFormOutput,
} from "@/lib/submission/album-form";
import { AlbumTracksSectionHeader } from "@/components/submission/album/AlbumTracksSectionHeader";

interface AlbumManualTracksSectionProps {
  form: UseFormReturn<
    AlbumSubmissionFormInput,
    unknown,
    AlbumSubmissionFormOutput
  >;
  fields: FieldArrayWithId<AlbumSubmissionFormInput, "tracks", "id">[];
  onAddTrack: () => void;
  onRemoveTrack: (index: number) => void;
  albumArtPreview: string;
  setAlbumArtPreview: (value: string) => void;
}

export function AlbumManualTracksSection({
  form,
  fields,
  onAddTrack,
  onRemoveTrack,
  albumArtPreview,
  setAlbumArtPreview,
}: AlbumManualTracksSectionProps) {
  return (
    <div className="space-y-4">
      <AlbumTracksSectionHeader onAddTrack={onAddTrack} />

      {fields.map((field, index) => (
        <Card key={field.id}>
          <CardContent className="pt-6">
            <div className="mb-4 flex items-start justify-between">
              <h4 className="font-medium">Track {index + 1}</h4>
              {fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveTrack(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name={`tracks.${index}.songTitle` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Track Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Track title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`tracks.${index}.artist` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artist (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Leave blank to use album artist"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Only fill this if different from album artist
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name={`tracks.${index}.songFile` as const}
              render={({ field: { onChange, value, ...rest } }) => (
                <FormItem className="mt-4">
                  <FormLabel>Audio File</FormLabel>
                  <FormControl>
                    <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                      <FileAudio className="size-6" />
                      <span className="text-center text-sm font-medium">
                        {value?.name && value.size > 0
                          ? "File selected"
                          : "Click to upload audio"}
                      </span>
                      <Input
                        type="file"
                        className="sr-only"
                        accept={AUDIO_UPLOAD_ACCEPT}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          if (file.size > MAX_SONG_SIZE_BYTES) {
                            toast.error(
                              `Song file is too large. Max size: ${MAX_SONG_SIZE_MB}MB.`,
                            );
                            form.setValue(
                              `tracks.${index}.songFile`,
                              undefined,
                            );
                            e.target.value = "";
                            return;
                          }

                          onChange(file);

                          try {
                            const metadata = await parseAudioFileMetadata(
                              file,
                              {
                                maxCoverArtSizeBytes: MAX_IMAGE_SIZE_BYTES,
                              },
                            );
                            if (metadata.durationSeconds) {
                              form.setValue(
                                `tracks.${index}.duration`,
                                metadata.durationSeconds,
                              );
                            }
                            if (
                              metadata.title &&
                              !form.getValues(`tracks.${index}.songTitle`)
                            ) {
                              form.setValue(
                                `tracks.${index}.songTitle`,
                                metadata.title,
                              );
                            }
                            if (
                              metadata.artist &&
                              !form.getValues(`tracks.${index}.artist`)
                            ) {
                              form.setValue(
                                `tracks.${index}.artist`,
                                metadata.artist,
                              );
                            }
                            if (
                              metadata.album &&
                              !form.getValues("albumName")
                            ) {
                              form.setValue("albumName", metadata.album);
                            }
                            if (
                              metadata.albumArtist &&
                              !form.getValues("albumArtist")
                            ) {
                              form.setValue(
                                "albumArtist",
                                metadata.albumArtist,
                              );
                            }
                            if (
                              metadata.year &&
                              !form.getValues("releaseYear")
                            ) {
                              form.setValue("releaseYear", metadata.year);
                            }

                            if (
                              index === 0 &&
                              !albumArtPreview &&
                              metadata.coverArtFile
                            ) {
                              form.setValue(
                                "albumArtFile",
                                metadata.coverArtFile,
                              );
                              const newPreviewUrl = URL.createObjectURL(
                                metadata.coverArtFile,
                              );
                              setAlbumArtPreview(newPreviewUrl);
                            }
                          } catch (error) {
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
