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
import type { EditSubmissionFormValues } from "@/lib/submission/edit-form";

interface EditBasicsFieldsProps {
  form: UseFormReturn<EditSubmissionFormValues>;
}

export function EditBasicsFields({ form }: EditBasicsFieldsProps) {
  return (
    <div className="space-y-6">
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
