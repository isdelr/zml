"use client";

import { UseFormReturn } from "react-hook-form";
import { ImagePlus, Loader2 } from "lucide-react";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MediaImage } from "@/components/ui/media-image";
import { TabsContent } from "@/components/ui/tabs";
import type { EditSubmissionFormValues } from "@/lib/submission/edit-form";
import { YouTubeIcon } from "@/components/icons/BrandIcons";
import { cn } from "@/lib/utils";

interface EditLinkTabProps {
  form: UseFormReturn<EditSubmissionFormValues>;
  albumArtPreview: string | null;
  detailsUnlocked: boolean;
  isFetchingLinkMeta: boolean;
}

export function EditLinkTab({
  form,
  albumArtPreview,
  detailsUnlocked,
  isFetchingLinkMeta,
}: EditLinkTabProps) {
  return (
    <TabsContent value="link" className="mt-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormField
          control={form.control}
          name="songLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>YouTube Link</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    {...field}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-3">
                    {isFetchingLinkMeta ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <YouTubeIcon className="size-4 text-red-500" />
                    )}
                  </div>
                </div>
              </FormControl>
              <FormDescription>
                Paste the link to the song you want to submit. We&apos;ll fetch
                the details automatically as you update it.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div
          className={cn(
            "space-y-2 transition-opacity",
            !detailsUnlocked && "opacity-55",
          )}
        >
          <FormLabel>Album Art</FormLabel>
          {albumArtPreview ? (
            <MediaImage
              src={albumArtPreview}
              alt="YouTube thumbnail preview"
              width={192}
              height={192}
              className="aspect-square w-48 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed bg-muted/40 text-muted-foreground/60">
              <ImagePlus className="size-8" />
              <span className="text-center text-sm font-medium">
                Fetched from YouTube
              </span>
            </div>
          )}
        </div>
      </div>
    </TabsContent>
  );
}
