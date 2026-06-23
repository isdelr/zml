"use client";

import { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { SongSubmissionFormValues } from "@/lib/submission/song-form";
import { cn } from "@/lib/utils";

interface SongDetailsFieldsProps {
  form: UseFormReturn<SongSubmissionFormValues>;
  disabled?: boolean;
}

export function SongDetailsFields({
  form,
  disabled = false,
}: SongDetailsFieldsProps) {
  return (
    <div
      className={cn(
        "space-y-6 rounded-md transition-opacity",
        disabled && "opacity-55",
      )}
    >
      <FormField
        control={form.control}
        name="songTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Song Title</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., Bohemian Rhapsody"
                disabled={disabled}
                {...field}
              />
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
              <Input
                placeholder="e.g., Artist 1, Artist 2"
                disabled={disabled}
                {...field}
              />
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
              <Input
                placeholder="e.g., A Night at the Opera"
                disabled={disabled}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="year"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Release Year</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="e.g., 1997"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                disabled={disabled}
                value={typeof field.value === "number" ? field.value : ""}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
