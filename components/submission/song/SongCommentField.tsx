"use client";

import { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { SongSubmissionFormValues } from "@/lib/submission/song-form";

interface SongCommentFieldProps {
  form: UseFormReturn<SongSubmissionFormValues>;
}

export function SongCommentField({ form }: SongCommentFieldProps) {
  return (
    <FormField
      control={form.control}
      name="comment"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Comment (Optional)</FormLabel>
          <FormControl>
            <Textarea placeholder="Add a little comment about your song..." {...field} />
          </FormControl>
          <FormDescription>
            This comment will be shown anonymously alongside your song during the
            voting phase.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
