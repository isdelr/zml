"use client";

import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
} from "@/lib/submission/constants";
import type {
  AlbumSubmissionFormInput,
  AlbumSubmissionFormOutput,
} from "@/lib/submission/album-form";

interface AlbumArtUploadFieldProps {
  form: UseFormReturn<AlbumSubmissionFormInput, unknown, AlbumSubmissionFormOutput>;
  albumArtPreview: string;
  setAlbumArtPreview: (value: string) => void;
}

export function AlbumArtUploadField({
  form,
  albumArtPreview,
  setAlbumArtPreview,
}: AlbumArtUploadFieldProps) {
  return (
    <FormField
      control={form.control}
      name="albumArtFile"
      render={({ field }) => {
        const { onChange, value, ...rest } = field;
        void value;
        return (
          <FormItem>
            <FormLabel>Album Art</FormLabel>
            {albumArtPreview ? (
              <div className="relative">
                <Image
                  src={albumArtPreview}
                  alt="Album art preview"
                  width={192}
                  height={192}
                  className="aspect-square w-48 rounded-md object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -right-2 -top-2 z-10 size-6 rounded-full"
                  onClick={() => {
                    form.setValue("albumArtFile", undefined);
                    URL.revokeObjectURL(albumArtPreview);
                    setAlbumArtPreview("");
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <FormControl>
                <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                  <ImagePlus className="size-8" />
                  <span className="text-sm font-medium">Click to upload image</span>
                  <Input
                    type="file"
                    style={{ top: 0, left: 0 }}
                    className="sr-only"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > MAX_IMAGE_SIZE_BYTES) {
                          toast.error(
                            `Image is too large. Max size: ${MAX_IMAGE_SIZE_MB}MB.`,
                          );
                          return;
                        }
                        onChange(file);
                        const newPreviewUrl = URL.createObjectURL(file);
                        if (albumArtPreview) {
                          URL.revokeObjectURL(albumArtPreview);
                        }
                        setAlbumArtPreview(newPreviewUrl);
                      }
                    }}
                    {...rest}
                  />
                </label>
              </FormControl>
            )}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
