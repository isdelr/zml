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
import { Input } from "@/components/ui/input";
import type { EditSubmissionFormValues } from "@/lib/submission/edit-form";

interface EditBasicsFieldsProps {
  form: UseFormReturn<EditSubmissionFormValues>;
}

export function EditBasicsFields({ form }: EditBasicsFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <FormField
        control={form.control}
        name="songTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Song Title</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="artist"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Artist</FormLabel>
            <FormControl>
              <Input placeholder="Artist 1, Artist 2" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="albumName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Album</FormLabel>
            <FormControl>
              <Input placeholder="Album name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
