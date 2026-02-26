"use client";

import { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { Trash2 } from "lucide-react";

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
import { MultiTracksSectionHeader } from "@/components/submission/multi/MultiTracksSectionHeader";
import type {
  MultiSongSubmissionFormInput,
  MultiSongSubmissionFormOutput,
} from "@/lib/submission/multi-form";
import { YouTubeIcon } from "@/components/icons/BrandIcons";

interface MultiLinkTracksSectionProps {
  form: UseFormReturn<
    MultiSongSubmissionFormInput,
    unknown,
    MultiSongSubmissionFormOutput
  >;
  fields: FieldArrayWithId<MultiSongSubmissionFormInput, "tracks", "id">[];
  remainingSongs: number;
  onAddTrack: () => void;
  onRemoveTrack: (index: number) => void;
}

export function MultiLinkTracksSection({
  form,
  fields,
  remainingSongs,
  onAddTrack,
  onRemoveTrack,
}: MultiLinkTracksSectionProps) {
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
              <CardTitle className="flex items-center gap-2 text-base">
                <YouTubeIcon className="size-4 text-red-500" />
                Song {index + 1}
              </CardTitle>
              {fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveTrack(index)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name={`tracks.${index}.songLink` as const}
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
                name={`tracks.${index}.songTitle` as const}
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
                name={`tracks.${index}.artist` as const}
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
