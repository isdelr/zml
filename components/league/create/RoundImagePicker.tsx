import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { toSvg } from "jdenticon";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { CreateLeagueForm, PreviewMapSetter } from "./form-types";

type RoundImagePickerProps = {
  form: CreateLeagueForm;
  index: number;
  previewUrl?: string;
  setPreviews: PreviewMapSetter;
};

export function RoundImagePicker({
  form,
  index,
  previewUrl,
  setPreviews,
}: RoundImagePickerProps) {
  return (
    <FormField
      control={form.control}
      name={`rounds.${index}.imageFile`}
      render={({ field: { onChange, ...rest } }) => (
        <FormItem>
          <FormLabel>Round Image (Optional)</FormLabel>
          {previewUrl ? (
            <div className="relative">
              <Image
                src={previewUrl}
                alt={`Preview for round ${index + 1}`}
                width={200}
                height={200}
                className="aspect-square w-full rounded-md object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -right-2 -top-2 z-10 size-6 rounded-full"
                onClick={() => {
                  form.setValue(`rounds.${index}.imageFile`, undefined);
                  setPreviews((previous) => {
                    const next = { ...previous };
                    if (previous[index]) {
                      URL.revokeObjectURL(previous[index]);
                    }
                    delete next[index];
                    return next;
                  });
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="relative aspect-square w-full rounded-md bg-muted">
              <div
                className="generated-art size-full"
                dangerouslySetInnerHTML={{
                  __html: toSvg(form.getValues(`rounds.${index}.title`) || `round-${index}`, 200),
                }}
              />
              <FormControl>
                <label className="absolute inset-0 flex h-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100">
                  <ImagePlus className="size-8" />
                  <span className="text-sm font-medium">Upload Image</span>
                  <Input
                    type="file"
                    className="sr-only"
                    accept="image/png, image/jpeg, image/gif"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        onChange(file);
                        setPreviews((previous) => ({
                          ...previous,
                          [index]: URL.createObjectURL(file),
                        }));
                      }
                    }}
                    name={rest.name}
                    onBlur={rest.onBlur}
                    ref={rest.ref}
                    disabled={rest.disabled}
                  />
                </label>
              </FormControl>
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
