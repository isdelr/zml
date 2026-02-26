"use client";

import Image from "next/image";
import { Dispatch, SetStateAction } from "react";
import { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { FileAudio, ImagePlus, Music, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type {
  MultiSongSubmissionFormInput,
  MultiSongSubmissionFormOutput,
} from "@/lib/submission/multi-form";
import { MultiTracksSectionHeader } from "@/components/submission/multi/MultiTracksSectionHeader";
import type { MultiTrackPreviews } from "@/components/submission/multi/types";

interface MultiManualTracksSectionProps {
  form: UseFormReturn<
    MultiSongSubmissionFormInput,
    unknown,
    MultiSongSubmissionFormOutput
  >;
  fields: FieldArrayWithId<MultiSongSubmissionFormInput, "tracks", "id">[];
  remainingSongs: number;
  trackPreviews: MultiTrackPreviews;
  setTrackPreviews: Dispatch<SetStateAction<MultiTrackPreviews>>;
  onAddTrack: () => void;
  onRemoveTrack: (index: number) => void;
}

export function MultiManualTracksSection({
  form,
  fields,
  remainingSongs,
  trackPreviews,
  setTrackPreviews,
  onAddTrack,
  onRemoveTrack,
}: MultiManualTracksSectionProps) {
  return (
    <>
      <MultiTracksSectionHeader
        trackCount={fields.length}
        remainingSongs={remainingSongs}
        onAddTrack={onAddTrack}
        disabled={fields.length >= remainingSongs}
      />

      {fields.map((field, index) => (
        <Card key={field.id} className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Song {index + 1}</CardTitle>
              {fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onRemoveTrack(index);
                    setTrackPreviews((prev) => {
                      const next = { ...prev };
                      delete next[index];
                      return next;
                    });
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name={`tracks.${index}.songTitle` as const}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Song Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter song title" {...field} />
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
                    <FormLabel>Artist *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter artist name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name={`tracks.${index}.albumArtFile` as const}
                render={({ field }) => {
                  const { onChange, value, ...rest } = field;
                  void value;
                  return (
                    <FormItem>
                      <FormLabel>Album Art *</FormLabel>
                      {trackPreviews[index]?.art ? (
                        <div className="relative h-32 w-32">
                          <Image
                            src={trackPreviews[index].art}
                            alt="Album art"
                            width={128}
                            height={128}
                            className="rounded-md object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -right-2 -top-2 size-6 rounded-full"
                            onClick={() => {
                              form.setValue(
                                `tracks.${index}.albumArtFile`,
                                undefined,
                              );
                              setTrackPreviews((prev) => {
                                const next = { ...prev };
                                delete next[index];
                                return next;
                              });
                            }}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <FormControl>
                          <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                            <ImagePlus className="size-6" />
                            <span className="text-center text-xs">
                              Upload image
                            </span>
                            <Input
                              type="file"
                              className="sr-only"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > MAX_IMAGE_SIZE_BYTES) {
                                    toast.error(
                                      `Image too large. Max: ${MAX_IMAGE_SIZE_MB}MB`,
                                    );
                                    return;
                                  }
                                  onChange(file);
                                  const url = URL.createObjectURL(file);
                                  setTrackPreviews((prev) => ({
                                    ...prev,
                                    [index]: { ...prev[index], art: url },
                                  }));
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
                name={`tracks.${index}.songFile` as const}
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <FormLabel>Audio File *</FormLabel>
                    <FormControl>
                      <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                        <FileAudio className="size-6" />
                        <span className="text-center text-xs">
                          {value?.name ? "File selected" : "Upload audio"}
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
                                `File too large. Max: ${MAX_SONG_SIZE_MB}MB`,
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
                                metadata.coverArtFile &&
                                !trackPreviews[index]?.art
                              ) {
                                form.setValue(
                                  `tracks.${index}.albumArtFile`,
                                  metadata.coverArtFile,
                                );
                                const url = URL.createObjectURL(
                                  metadata.coverArtFile,
                                );
                                setTrackPreviews((prev) => ({
                                  ...prev,
                                  [index]: { ...prev[index], art: url },
                                }));
                              }
                              toast.success("Metadata extracted!");
                            } catch (error) {
                              console.warn("Metadata parsing error:", error);
                            }
                          }}
                          {...rest}
                        />
                      </label>
                    </FormControl>
                    {value?.name ? (
                      <FormDescription className="flex items-center gap-2 text-xs">
                        <Music className="size-3" />
                        <span className="truncate">{value.name}</span>
                      </FormDescription>
                    ) : null}
                    <FormDescription className="text-xs">
                      Supported formats: {SUPPORTED_AUDIO_UPLOAD_FORMATS_LABEL}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name={`tracks.${index}.comment` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a note about this song..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
