"use client";

import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type {
  AlbumSubmissionFormInput,
  AlbumSubmissionFormOutput,
} from "@/lib/submission/album-form";

interface AlbumNameArtistFieldsProps {
  form: UseFormReturn<AlbumSubmissionFormInput, unknown, AlbumSubmissionFormOutput>;
}

export function AlbumNameArtistFields({ form }: AlbumNameArtistFieldsProps) {
  return (
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
  );
}
