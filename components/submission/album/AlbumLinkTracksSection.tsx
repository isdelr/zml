"use client";

import { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { Trash2 } from "lucide-react";

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
import type {
  AlbumSubmissionFormInput,
  AlbumSubmissionFormOutput,
} from "@/lib/submission/album-form";
import { AlbumTracksSectionHeader } from "@/components/submission/album/AlbumTracksSectionHeader";

interface AlbumLinkTracksSectionProps {
  form: UseFormReturn<AlbumSubmissionFormInput, unknown, AlbumSubmissionFormOutput>;
  fields: FieldArrayWithId<AlbumSubmissionFormInput, "tracks", "id">[];
  onAddTrack: () => void;
  onRemoveTrack: (index: number) => void;
}

export function AlbumLinkTracksSection({
  form,
  fields,
  onAddTrack,
  onRemoveTrack,
}: AlbumLinkTracksSectionProps) {
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

            <FormField
              control={form.control}
              name={`tracks.${index}.songLink` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube Link</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://www.youtube.com/watch?v=..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Track title will be fetched automatically
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name={`tracks.${index}.songTitle` as const}
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
