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
import { TabsContent } from "@/components/ui/tabs";
import type { SongSubmissionFormValues } from "@/lib/submission/song-form";
import { YouTubeIcon } from "@/components/icons/BrandIcons";

interface SongLinkTabProps {
  form: UseFormReturn<SongSubmissionFormValues>;
}

export function SongLinkTab({ form }: SongLinkTabProps) {
  return (
    <TabsContent value="link" className="mt-6">
      <FormField
        control={form.control}
        name="songLink"
        render={({ field }) => (
          <FormItem>
            <FormLabel>YouTube Link</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  placeholder="https://www.youtube.com/watch?v=8OcKBa9QYaI"
                  {...field}
                />
                <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-3">
                  <YouTubeIcon className="size-4 text-red-500" />
                </div>
              </div>
            </FormControl>
            <FormDescription>
              Paste the link to the song you want to submit. We&apos;ll fetch the
              details automatically.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </TabsContent>
  );
}
