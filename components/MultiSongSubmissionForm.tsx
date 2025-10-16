"use client";

import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { FileAudio, ImagePlus, Loader2, Music, X, Plus, Trash2, Upload } from "lucide-react";
import { useUploadFile } from "@convex-dev/r2/react";
import { useState } from "react";
import Image from "next/image";
import * as mm from "music-metadata-browser";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaYoutube } from "react-icons/fa";
import { Progress } from "@/components/ui/progress";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_SONG_SIZE_MB = 150;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_SONG_SIZE_BYTES = MAX_SONG_SIZE_MB * 1024 * 1024;

const trackSchema = z.object({
  songTitle: z.string().min(1, "Track title is required"),
  artist: z.string().min(1, "Artist is required"),
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
  duration: z.number().optional(),
});

const formSchema = z.object({
  submissionType: z.enum(["manual", "link"]),
  tracks: z.array(trackSchema).min(1, "At least one track is required"),
}).refine((data) => {
  if (data.submissionType === "manual") {
    return data.tracks.every(t => 
      t.songFile && t.songFile.size > 0 && 
      t.albumArtFile && t.albumArtFile.size > 0
    );
  }
  if (data.submissionType === "link") {
    return data.tracks.every(t => 
      t.songLink && 
      (t.songLink.includes("youtube.com") || t.songLink.includes("youtu.be"))
    );
  }
  return false;
}, {
  message: "Please complete all required fields for your chosen submission type.",
  path: ["submissionType"],
});

type FormValues = z.infer<typeof formSchema>;

interface MultiSongSubmissionFormProps {
  roundId: Id<"rounds">;
  maxSongs: number;
  currentCount: number;
}

export function MultiSongSubmissionForm({ roundId, maxSongs, currentCount }: MultiSongSubmissionFormProps) {
  const submitSong = useMutation(api.submissions.submitSong);
  const getSongMetadataFromLink = useAction(api.submissions.getSongMetadataFromLink);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });

  const round = useQuery(api.rounds.get, { roundId });
  const [trackPreviews, setTrackPreviews] = useState<Record<number, { art: string; file?: string }>>({});
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      submissionType: "manual",
      tracks: [{ songTitle: "", artist: "", comment: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tracks",
  });

  const remainingSongs = maxSongs - currentCount;

  const handleFinalSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    const toastId = toast.loading(`Submitting ${values.tracks.length} song(s)...`);
    
    try {
      const totalTracks = values.tracks.length;
      const collectionId = `${roundId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (values.submissionType === "manual") {
        for (let i = 0; i < values.tracks.length; i++) {
          const track = values.tracks[i];
          if (!track.songFile || !track.albumArtFile) continue;
          
          setUploadProgress(Math.round(((i + 0.5) / totalTracks) * 100));
          
          const [albumArtKey, songFileKey] = await Promise.all([
            uploadFile(track.albumArtFile),
            uploadFile(track.songFile),
          ]);
          
          await submitSong({
            roundId,
            submissionType: "file",
            songTitle: track.songTitle,
            artist: track.artist,
            albumArtKey,
            songFileKey,
            duration: track.duration,
            comment: track.comment,
            collectionId,
            collectionType: "multi",
          });
          
          setUploadProgress(Math.round(((i + 1) / totalTracks) * 100));
        }
      } else if (values.submissionType === "link") {
        for (let i = 0; i < values.tracks.length; i++) {
          const track = values.tracks[i];
          if (!track.songLink) continue;
          
          setUploadProgress(Math.round(((i + 0.5) / totalTracks) * 100));
          
          const metadata = await getSongMetadataFromLink({ link: track.songLink });
          
          await submitSong({
            roundId,
            submissionType: metadata.submissionType,
            songTitle: track.songTitle || metadata.songTitle,
            artist: track.artist || metadata.artist,
            songLink: track.songLink,
            albumArtUrlValue: metadata.albumArtUrl,
            duration: metadata.duration,
            comment: track.comment,
            collectionId,
            collectionType: "multi",
          });
          
          setUploadProgress(Math.round(((i + 1) / totalTracks) * 100));
        }
      }

      toast.success(`Successfully submitted ${values.tracks.length} song(s)!`, { id: toastId });
      form.reset();
      setTrackPreviews({});
      setUploadProgress(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Submission failed: ${errorMessage}`, { id: toastId });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  async function onSubmit(values: FormValues) {
    if (values.tracks.length > remainingSongs) {
      toast.error(`You can only submit ${remainingSongs} more song(s)`);
      return;
    }
    await handleFinalSubmit(values);
  }

  if (round === undefined) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading round information...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Submit Your Songs</h2>
        <p className="text-muted-foreground">
          You can submit up to {remainingSongs} more song{remainingSongs !== 1 ? 's' : ''} for this round.
        </p>
        {round.submissionInstructions && (
          <p className="mt-2 text-sm text-muted-foreground italic">
            {round.submissionInstructions}
          </p>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs
            defaultValue="manual"
            className="w-full"
            onValueChange={(value) => form.setValue("submissionType", value as "manual" | "link")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">
                <Upload className="mr-2 size-4" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="link">
                <FaYoutube className="mr-2 size-4" />
                YouTube Links
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Songs ({fields.length}/{remainingSongs})
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (fields.length >= remainingSongs) {
                      toast.error(`You can only add ${remainingSongs} song(s) total`);
                      return;
                    }
                    append({ songTitle: "", artist: "", comment: "" });
                  }}
                  disabled={fields.length >= remainingSongs}
                >
                  <Plus className="mr-2 size-4" />
                  Add Song
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Song {index + 1}</CardTitle>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            remove(index);
                            const newPreviews = { ...trackPreviews };
                            delete newPreviews[index];
                            setTrackPreviews(newPreviews);
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`tracks.${index}.songTitle`}
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
                        name={`tracks.${index}.artist`}
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
                        name={`tracks.${index}.albumArtFile`}
                        render={({ field: { onChange, value, ...rest } }) => (
                          <FormItem>
                            <FormLabel>Album Art *</FormLabel>
                            {trackPreviews[index]?.art ? (
                              <div className="relative w-32 h-32">
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
                                    form.setValue(`tracks.${index}.albumArtFile`, undefined);
                                    const newPreviews = { ...trackPreviews };
                                    delete newPreviews[index];
                                    setTrackPreviews(newPreviews);
                                  }}
                                >
                                  <X className="size-4" />
                                </Button>
                              </div>
                            ) : (
                              <FormControl>
                                <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                                  <ImagePlus className="size-6" />
                                  <span className="text-xs text-center">Upload image</span>
                                  <Input
                                    type="file"
                                    className="sr-only"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > MAX_IMAGE_SIZE_BYTES) {
                                          toast.error(`Image too large. Max: ${MAX_IMAGE_SIZE_MB}MB`);
                                          return;
                                        }
                                        onChange(file);
                                        const url = URL.createObjectURL(file);
                                        setTrackPreviews(prev => ({
                                          ...prev,
                                          [index]: { ...prev[index], art: url }
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
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`tracks.${index}.songFile`}
                        render={({ field: { onChange, value, ...rest } }) => (
                          <FormItem>
                            <FormLabel>Audio File *</FormLabel>
                            <FormControl>
                              <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                                <FileAudio className="size-6" />
                                <span className="text-xs text-center">
                                  {value?.name ? "File selected" : "Upload audio"}
                                </span>
                                <Input
                                  type="file"
                                  className="sr-only"
                                  accept="audio/*,.flac"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (file.size > MAX_SONG_SIZE_BYTES) {
                                      toast.error(`File too large. Max: ${MAX_SONG_SIZE_MB}MB`);
                                      e.target.value = "";
                                      return;
                                    }

                                    onChange(file);

                                    try {
                                      const metadata = await mm.parseBlob(file);
                                      if (metadata.format.duration) {
                                        form.setValue(`tracks.${index}.duration`, Math.round(metadata.format.duration));
                                      }
                                      if (metadata.common.title && !form.getValues(`tracks.${index}.songTitle`)) {
                                        form.setValue(`tracks.${index}.songTitle`, metadata.common.title);
                                      }
                                      if (metadata.common.artist && !form.getValues(`tracks.${index}.artist`)) {
                                        form.setValue(`tracks.${index}.artist`, metadata.common.artist);
                                      }
                                      
                                      const picture = metadata.common.picture?.[0];
                                      if (picture && !trackPreviews[index]?.art) {
                                        const artFile = new File(
                                          [picture.data],
                                          `cover.${picture.format.split("/")[1]}`,
                                          { type: picture.format }
                                        );
                                        if (artFile.size <= MAX_IMAGE_SIZE_BYTES) {
                                          form.setValue(`tracks.${index}.albumArtFile`, artFile);
                                          const url = URL.createObjectURL(artFile);
                                          setTrackPreviews(prev => ({
                                            ...prev,
                                            [index]: { ...prev[index], art: url }
                                          }));
                                        }
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
                            {value?.name && (
                              <FormDescription className="flex items-center gap-2 text-xs">
                                <Music className="size-3" />
                                <span className="truncate">{value.name}</span>
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`tracks.${index}.comment`}
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
            </TabsContent>

            <TabsContent value="link" className="mt-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Songs ({fields.length}/{remainingSongs})
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (fields.length >= remainingSongs) {
                      toast.error(`You can only add ${remainingSongs} song(s) total`);
                      return;
                    }
                    append({ songTitle: "", artist: "", comment: "" });
                  }}
                  disabled={fields.length >= remainingSongs}
                >
                  <Plus className="mr-2 size-4" />
                  Add Song
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FaYoutube className="text-red-500" />
                        Song {index + 1}
                      </CardTitle>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`tracks.${index}.songLink`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>YouTube Link *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://www.youtube.com/watch?v=..."
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Metadata will be fetched automatically
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`tracks.${index}.songTitle`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title Override (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Leave blank to auto-fetch" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`tracks.${index}.artist`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Artist Override (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Leave blank to auto-fetch" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`tracks.${index}.comment`}
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
            </TabsContent>
          </Tabs>

          {isSubmitting && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Upload Progress</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || fields.length === 0}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Uploading... {uploadProgress}%
                </>
              ) : (
                <>
                  Submit {fields.length} Song{fields.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

