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
import { FileAudio, ImagePlus, Loader2, Music, X, Plus, Trash2, Upload, GripVertical, Info } from "lucide-react";
import { useUploadFile } from "@convex-dev/r2/react";
import { useState } from "react";
import Image from "next/image";
import * as mm from "music-metadata-browser";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaYoutube } from "react-icons/fa";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_SONG_SIZE_MB = 150;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_SONG_SIZE_BYTES = MAX_SONG_SIZE_MB * 1024 * 1024;

const trackSchema = z.object({
  trackNumber: z.number().min(1),
  songTitle: z.string().min(1, "Track title is required"),
  artist: z.string().optional(),
  albumArtFile: z.instanceof(File).optional(),
  songFile: z.instanceof(File).optional().refine(
    (file) => !file || file.size <= MAX_SONG_SIZE_BYTES,
    `Max song size is ${MAX_SONG_SIZE_MB}MB.`
  ),
  songLink: z.string().optional(),
  duration: z.number().optional(),
});

const formSchema = z.object({
  submissionType: z.enum(["manual", "link"]),
  albumName: z.string().min(1, "Album name is required"),
  albumArtist: z.string().min(1, "Album artist is required"),
  albumArtFile: z.instanceof(File).optional().refine(
    (file) => !file || file.size <= MAX_IMAGE_SIZE_BYTES,
    `Max image size is ${MAX_IMAGE_SIZE_MB}MB.`
  ),
  releaseYear: z.coerce.number().optional(),
  albumNotes: z.string().optional(),
  tracks: z.array(trackSchema).min(1, "At least one track is required"),
}).refine((data) => {
  if (data.submissionType === "manual") {
    // All tracks must have files
    return data.tracks.every(t => t.songFile && t.songFile.size > 0) && data.albumArtFile && data.albumArtFile.size > 0;
  }
  if (data.submissionType === "link") {
    // All tracks must have valid YouTube links
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

interface AlbumSubmissionFormProps {
  roundId: Id<"rounds">;
}

export function AlbumSubmissionForm({ roundId }: AlbumSubmissionFormProps) {
  const submitSong = useMutation(api.submissions.submitSong);
  const getSongMetadataFromLink = useAction(api.submissions.getSongMetadataFromLink);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateSubmissionFileUploadUrl,
    syncMetadata: api.files.syncSubmissionFileMetadata,
  });

  const round = useQuery(api.rounds.get, { roundId });
  const [albumArtPreview, setAlbumArtPreview] = useState<string>("");
  const [trackPreviews, setTrackPreviews] = useState<Record<number, string>>({});
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      submissionType: "manual",
      albumName: "",
      albumArtist: "",
      releaseYear: undefined,
      albumNotes: "",
      tracks: [{ trackNumber: 1, songTitle: "", artist: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tracks",
  });

  const handleFinalSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    const toastId = toast.loading(`Submitting album with ${values.tracks.length} tracks...`);
    
    try {
      const collectionId = `${roundId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const totalTracks = values.tracks.length;
      
      if (values.submissionType === "manual" && values.albumArtFile) {
        setUploadProgress(5);
        const albumArtKey = await uploadFile(values.albumArtFile);
        setUploadProgress(10);
        
        for (let i = 0; i < values.tracks.length; i++) {
          const track = values.tracks[i];
          if (!track.songFile) continue;
          
          // Upload progress: 10% for album art, 90% for tracks
          const trackProgress = 10 + Math.round(((i + 0.5) / totalTracks) * 90);
          setUploadProgress(trackProgress);
          
          const songFileKey = await uploadFile(track.songFile);
          
          await submitSong({
            roundId,
            submissionType: "file",
            songTitle: track.songTitle,
            artist: track.artist || values.albumArtist,
            albumArtKey,
            songFileKey,
            duration: track.duration,
            comment: undefined,
            collectionId,
            collectionType: "album",
            collectionName: values.albumName,
            collectionArtist: values.albumArtist,
            collectionReleaseYear: values.releaseYear,
            collectionNotes: values.albumNotes,
            collectionTotalTracks: values.tracks.length,
            trackNumber: track.trackNumber,
          });
          
          const completedProgress = 10 + Math.round(((i + 1) / totalTracks) * 90);
          setUploadProgress(completedProgress);
        }
      } else if (values.submissionType === "link") {
        for (let i = 0; i < values.tracks.length; i++) {
          const track = values.tracks[i];
          if (!track.songLink) continue;
          
          const trackProgress = Math.round(((i + 0.5) / totalTracks) * 100);
          setUploadProgress(trackProgress);
          
          const metadata = await getSongMetadataFromLink({ link: track.songLink });
          
          await submitSong({
            roundId,
            submissionType: metadata.submissionType,
            songTitle: track.songTitle || metadata.songTitle,
            artist: track.artist || values.albumArtist,
            songLink: track.songLink,
            albumArtUrlValue: metadata.albumArtUrl,
            duration: metadata.duration,
            comment: undefined,
            collectionId,
            collectionType: "album",
            collectionName: values.albumName,
            collectionArtist: values.albumArtist,
            collectionReleaseYear: values.releaseYear,
            collectionNotes: values.albumNotes,
            collectionTotalTracks: values.tracks.length,
            trackNumber: track.trackNumber,
          });
          
          const completedProgress = Math.round(((i + 1) / totalTracks) * 100);
          setUploadProgress(completedProgress);
        }
      }

      setUploadProgress(100);
      toast.success(`Album with ${values.tracks.length} track(s) submitted successfully!`, { id: toastId });
      form.reset();
      setAlbumArtPreview("");
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

  const albumConfig = round.albumConfig;
  const minTracks = albumConfig?.minTracks;
  const maxTracks = albumConfig?.maxTracks;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-2xl font-bold">Submit Your Album</h2>
      <p className="mb-6 text-muted-foreground">
        Upload multiple tracks as an album submission.
        {minTracks && maxTracks && ` (${minTracks}-${maxTracks} tracks required)`}
        {minTracks && !maxTracks && ` (at least ${minTracks} tracks required)`}
        {!minTracks && maxTracks && ` (up to ${maxTracks} tracks)`}
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs
            defaultValue="manual"
            className="w-full"
            onValueChange={(value) => form.setValue("submissionType", value as "manual" | "link")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual Upload</TabsTrigger>
              <TabsTrigger value="link">YouTube Links</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="albumName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Album Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Abbey Road" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="albumArtist"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Album Artist</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., The Beatles" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {albumConfig?.requireReleaseYear && (
                  <FormField
                    control={form.control}
                    name="releaseYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Release Year</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 1969" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                            <span className="text-sm font-medium">Click to upload image</span>
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
              </div>

              <FormField
                control={form.control}
                name="albumNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Album Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add notes about this album..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Tracks</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const maxAllowed = maxTracks || 50;
                      if (fields.length >= maxAllowed) {
                        toast.error(`Maximum ${maxAllowed} tracks allowed`);
                        return;
                      }
                      append({ 
                        trackNumber: fields.length + 1, 
                        songTitle: "", 
                        artist: "" 
                      });
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add Track
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-medium">Track {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const minRequired = minTracks || 1;
                              if (fields.length <= minRequired) {
                                toast.error(`At least ${minRequired} track(s) required`);
                                return;
                              }
                              remove(index);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`tracks.${index}.songTitle`}
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
                          name={`tracks.${index}.artist`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Artist (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Leave blank to use album artist" {...field} />
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
                        name={`tracks.${index}.songFile`}
                        render={({ field: { onChange, value, ...rest } }) => (
                          <FormItem className="mt-4">
                            <FormLabel>Audio File</FormLabel>
                            <FormControl>
                              <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                                <FileAudio className="size-6" />
                                <span className="text-sm font-medium text-center">
                                  {value?.name && value.size > 0 ? "File selected" : "Click to upload audio"}
                                </span>
                                <Input
                                  type="file"
                                  className="sr-only"
                                  accept="audio/*,.flac"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (file.size > MAX_SONG_SIZE_BYTES) {
                                      toast.error(`Song file is too large. Max size: ${MAX_SONG_SIZE_MB}MB.`);
                                      form.setValue(`tracks.${index}.songFile`, undefined);
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
                                      if (metadata.common.album && !form.getValues("albumName")) {
                                        form.setValue("albumName", metadata.common.album);
                                      }
                                      if (metadata.common.albumartist && !form.getValues("albumArtist")) {
                                        form.setValue("albumArtist", metadata.common.albumartist);
                                      }
                                      if (metadata.common.year && !form.getValues("releaseYear")) {
                                        form.setValue("releaseYear", metadata.common.year);
                                      }
                                      
                                      // Extract album art from first track if not set
                                      if (index === 0 && !albumArtPreview) {
                                        const picture = metadata.common.picture?.[0];
                                        if (picture) {
                                          const artFile = new File(
                                            [picture.data],
                                            `cover.${picture.format.split("/")[1]}`,
                                            { type: picture.format }
                                          );
                                          if (artFile.size <= MAX_IMAGE_SIZE_BYTES) {
                                            form.setValue("albumArtFile", artFile);
                                            const newPreviewUrl = URL.createObjectURL(artFile);
                                            setAlbumArtPreview(newPreviewUrl);
                                          }
                                        }
                                      }
                                    } catch (error) {
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="link" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="albumName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Album Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Abbey Road" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="albumArtist"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Album Artist</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., The Beatles" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {albumConfig?.requireReleaseYear && (
                <FormField
                  control={form.control}
                  name="releaseYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Release Year</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 1969" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="albumNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Album Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add notes about this album..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Tracks</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const maxAllowed = maxTracks || 50;
                      if (fields.length >= maxAllowed) {
                        toast.error(`Maximum ${maxAllowed} tracks allowed`);
                        return;
                      }
                      append({ 
                        trackNumber: fields.length + 1, 
                        songTitle: "", 
                        artist: "" 
                      });
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add Track
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-medium">Track {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const minRequired = minTracks || 1;
                              if (fields.length <= minRequired) {
                                toast.error(`At least ${minRequired} track(s) required`);
                                return;
                              }
                              remove(index);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name={`tracks.${index}.songLink`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>YouTube Link</FormLabel>
                            <FormControl>
                              <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Track title will be fetched automatically
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
                        <FormField
                          control={form.control}
                          name={`tracks.${index}.songTitle`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Track Title (Override)</FormLabel>
                              <FormControl>
                                <Input placeholder="Optional override" {...field} />
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
                              <FormLabel>Artist (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Leave blank to use album artist" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Uploading... {uploadProgress}%
              </>
            ) : (
              <>
                Submit Album ({fields.length} track{fields.length !== 1 ? "s" : ""})
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}

