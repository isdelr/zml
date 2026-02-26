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

interface AlbumReleaseYearFieldProps {
  form: UseFormReturn<AlbumSubmissionFormInput, unknown, AlbumSubmissionFormOutput>;
}

export function AlbumReleaseYearField({ form }: AlbumReleaseYearFieldProps) {
  return (
    <FormField
      control={form.control}
      name="releaseYear"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Release Year</FormLabel>
          <FormControl>
            <Input
              type="number"
              placeholder="e.g., 1969"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
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
  );
}
