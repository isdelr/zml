"use client";

import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type {
  AlbumSubmissionFormInput,
  AlbumSubmissionFormOutput,
} from "@/lib/submission/album-form";

interface AlbumNotesFieldProps {
  form: UseFormReturn<AlbumSubmissionFormInput, unknown, AlbumSubmissionFormOutput>;
}

export function AlbumNotesField({ form }: AlbumNotesFieldProps) {
  return (
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
  );
}
