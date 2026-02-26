"use client";

import { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { EditSubmissionFormValues } from "@/lib/submission/edit-form";

interface EditCommentFieldProps {
  form: UseFormReturn<EditSubmissionFormValues>;
}

export function EditCommentField({ form }: EditCommentFieldProps) {
  return (
    <FormField
      control={form.control}
      name="comment"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Comment (Optional)</FormLabel>
          <FormControl>
            <Textarea placeholder="Update your comment..." {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
