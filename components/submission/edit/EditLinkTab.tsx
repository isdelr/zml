"use client";

import { UseFormReturn } from "react-hook-form";
import { Loader2 } from "lucide-react";

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
import type { EditSubmissionFormValues } from "@/lib/submission/edit-form";
import { YouTubeIcon } from "@/components/icons/BrandIcons";

interface EditLinkTabProps {
  form: UseFormReturn<EditSubmissionFormValues>;
  isFetchingLinkMeta: boolean;
}

export function EditLinkTab({ form, isFetchingLinkMeta }: EditLinkTabProps) {
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
              Paste the link to the song you want to submit. We&apos;ll fetch the
              details automatically as you update it.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </TabsContent>
  );
}
