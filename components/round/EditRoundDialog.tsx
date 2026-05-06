// File: components/round/EditRoundDialog.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { toast } from "sonner";
import { ImagePlus, Loader2, Info, X } from "lucide-react";
import { toSvg } from "jdenticon";
import { toErrorMessage } from "@/lib/errors";
import {
  MAX_ROUND_IMAGE_SIZE_BYTES,
  MAX_ROUND_IMAGE_SIZE_MB,
} from "@/lib/leagues/create-league-form";
import { useUploadFile } from "@/lib/storage/useUploadFile";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Doc } from "@/convex/_generated/dataModel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MediaImage } from "@/components/ui/media-image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const numberOrNull = z.preprocess(
  (val) => {
    if (val === "" || val === undefined || val === null) return null;
    if (typeof val === "string") {
      const n = Number(val);
      return Number.isNaN(n) ? null : n;
    }
    if (typeof val === "number") return val;
    return null;
  },
  z.union([z.number().int().min(0), z.null()]),
);

const roundEditSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters."),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters."),
    imageFile: z
      .instanceof(File)
      .optional()
      .refine(
        (file) => !file || file.size <= MAX_ROUND_IMAGE_SIZE_BYTES,
        `Image must be less than ${MAX_ROUND_IMAGE_SIZE_MB}MB.`,
      ),
    removeImage: z.boolean().default(false),
    submissionsPerUser: z.coerce
      .number()
      .min(1, "Must be at least 1.")
      .max(5, "Max 5 submissions per user."),
    maxPositiveVotes: numberOrNull.optional(),
    maxNegativeVotes: numberOrNull.optional(),
    submissionMode: z.enum(["single", "multi", "album"]).default("single"),
    submissionInstructions: z.string().optional(),
    albumConfig: z
      .object({
        allowPartial: z.boolean().optional(),
        requireReleaseYear: z.boolean().optional(),
        minTracks: z.coerce
          .number()
          .min(1, "Must be at least 1 track.")
          .optional(),
        maxTracks: z.coerce
          .number()
          .min(1, "Must be at least 1 track.")
          .optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.submissionMode === "album" && data.albumConfig) {
      const { minTracks, maxTracks } = data.albumConfig;
      if (
        minTracks !== undefined &&
        maxTracks !== undefined &&
        minTracks > maxTracks
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Minimum tracks cannot exceed maximum tracks.",
          path: ["albumConfig", "minTracks"],
        });
      }
    }
  });
type RoundEditInput = z.input<typeof roundEditSchema>;
type RoundEditOutput = z.output<typeof roundEditSchema>;
type RoundEditForm = UseFormReturn<RoundEditInput, unknown, RoundEditOutput>;
type EditableRound = Doc<"rounds"> & { art?: string | null };

interface EditRoundDialogProps {
  round: EditableRound;
  onClose: () => void;
}

export function EditRoundDialog({ round, onClose }: EditRoundDialogProps) {
  const updateRound = useMutation(api.rounds.updateRound);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateLeagueImageUploadUrl,
    syncMetadata: api.files.syncLeagueImageMetadata,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const form = useForm<RoundEditInput, unknown, RoundEditOutput>({
    resolver: zodResolver(roundEditSchema),
    defaultValues: {
      title: round.title || "",
      description: round.description || "",
      imageFile: undefined,
      removeImage: false,
      submissionsPerUser: round.submissionsPerUser ?? 1,
      maxPositiveVotes: round.maxPositiveVotes ?? null,
      maxNegativeVotes: round.maxNegativeVotes ?? null,
      submissionMode: round.submissionMode ?? "single",
      submissionInstructions: round.submissionInstructions ?? "",
      albumConfig: round.albumConfig ?? {
        allowPartial: undefined,
        requireReleaseYear: true,
        minTracks: undefined,
        maxTracks: undefined,
      },
    },
  });

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const submissionMode = useWatch({
    control: form.control,
    name: "submissionMode",
  });

  async function onSubmit(values: RoundEditOutput) {
    const { imageFile, removeImage, ...roundValues } = values;
    const promise = (async () => {
      let imageKey: string | null | undefined;
      if (imageFile) {
        imageKey = await uploadFile(imageFile);
      } else if (removeImage) {
        imageKey = null;
      }

      return updateRound({
        roundId: round._id,
        ...roundValues,
        ...(imageKey !== undefined ? { imageKey } : {}),
      });
    })();

    toast.promise(promise, {
      loading: "Updating round...",
      success: (msg) => {
        onClose();
        return msg;
      },
      error: (error) => toErrorMessage(error, "Failed to update round."),
    });

    try {
      await promise;
    } catch {
      // The toast handles the visible error state.
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">Basic Information</h3>
            <Badge variant="secondary">Required</Badge>
          </div>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Round Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Best of the 90s" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Round Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the theme of this round..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="w-full max-w-56">
            <RoundImageEditField
              form={form}
              round={round}
              previewUrl={previewUrl}
              setPreviewUrl={setPreviewUrl}
            />
          </div>

          <FormField
            control={form.control}
            name="submissionsPerUser"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Submissions per User</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    {...field}
                    value={(field.value as number) || ""}
                    disabled={round.status === "voting"}
                  />
                </FormControl>
                <FormDescription>
                  {round.status === "voting"
                    ? "⚠️ This cannot be changed while a round is in the voting phase."
                    : "⚠️ Changing this for a round with submissions will delete them and notify users to resubmit."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Advanced Options */}
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="voting" className="border rounded-lg px-4 mb-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Voting Overrides</span>
                <Badge variant="outline" className="text-xs">
                  Optional
                </Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Override league defaults for this round only</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Leave these fields empty to use the league&apos;s default voting
                rules.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="maxPositiveVotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Upvotes per Round</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={
                            typeof field.value === "number" ? field.value : ""
                          }
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                          placeholder="Use league default"
                        />
                      </FormControl>
                      <FormDescription>
                        Set to override league default
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxNegativeVotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Downvotes per Round</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={
                            typeof field.value === "number" ? field.value : ""
                          }
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                          placeholder="Use league default"
                        />
                      </FormControl>
                      <FormDescription>
                        Set to override league default
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="submission" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Submission Settings</span>
                <Badge variant="outline" className="text-xs">
                  Optional
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="submissionMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submission Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a submission mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single song</SelectItem>
                        <SelectItem value="multi">
                          Multiple songs (shuffled)
                        </SelectItem>
                        <SelectItem value="album">
                          Multiple songs (keep track order)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose how submissions should be grouped and presented for
                      this round.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="submissionInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submission Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide any extra guidelines, e.g. 'Upload 3 tracks that fit the theme.'"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      These instructions will be shown to participants when they
                      submit songs.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {submissionMode === "album" && (
                <div className="space-y-4 rounded-md border bg-muted/50 p-4">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Album Round Settings
                  </h4>
                  <FormField
                    control={form.control}
                    name="albumConfig.allowPartial"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Allow partial albums</FormLabel>
                          <FormDescription>
                            Participants can submit only a selection of tracks
                            instead of the full album.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="albumConfig.requireReleaseYear"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Require album release year</FormLabel>
                          <FormDescription>
                            Ensure every submission includes the album&apos;s
                            release year for context.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="albumConfig.minTracks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Tracks Required</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="Optional"
                              {...field}
                              value={(field.value as number) || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Leave blank to allow any length.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="albumConfig.maxTracks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Tracks Allowed</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="Optional"
                              {...field}
                              value={(field.value as number) || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Leave blank to allow any length.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}

type RoundImageEditFieldProps = {
  form: RoundEditForm;
  round: EditableRound;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
};

function RoundImageEditField({
  form,
  round,
  previewUrl,
  setPreviewUrl,
}: RoundImageEditFieldProps) {
  const removeImage = useWatch({
    control: form.control,
    name: "removeImage",
  });
  const displayUrl = previewUrl ?? (!removeImage ? (round.art ?? null) : null);
  const hasImage = Boolean(previewUrl || (!removeImage && round.imageKey));
  const fallbackSvg = toSvg(round.title || round._id, 200);

  return (
    <FormField
      control={form.control}
      name="imageFile"
      render={({ field: { onChange, ...rest } }) => (
        <FormItem>
          <FormLabel>Round Image (Optional)</FormLabel>
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
            {displayUrl ? (
              <MediaImage
                src={displayUrl}
                alt={`Image for ${round.title}`}
                width={200}
                height={200}
                className="size-full object-cover"
                unoptimized={displayUrl.startsWith("blob:") ? true : undefined}
                renderFallback={() => (
                  <div
                    className="generated-art size-full"
                    dangerouslySetInnerHTML={{ __html: fallbackSvg }}
                  />
                )}
              />
            ) : (
              <div
                className="generated-art size-full"
                dangerouslySetInnerHTML={{ __html: fallbackSvg }}
              />
            )}

            <FormControl>
              <label className="absolute inset-0 flex h-full cursor-pointer flex-col items-center justify-center gap-2 bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
                <ImagePlus className="size-8" />
                <span className="text-sm font-medium">
                  {hasImage ? "Change Image" : "Upload Image"}
                </span>
                <Input
                  type="file"
                  className="sr-only"
                  accept="image/png, image/jpeg, image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      onChange(file);
                      form.setValue("removeImage", false, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      setPreviewUrl(URL.createObjectURL(file));
                    }
                    event.currentTarget.value = "";
                  }}
                  name={rest.name}
                  onBlur={rest.onBlur}
                  ref={rest.ref}
                  disabled={rest.disabled}
                />
              </label>
            </FormControl>

            {hasImage ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 z-10 size-7 rounded-full"
                aria-label={
                  previewUrl
                    ? "Clear selected round image"
                    : "Remove round image"
                }
                onClick={() => {
                  onChange(undefined);
                  setPreviewUrl(null);
                  form.setValue("imageFile", undefined, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  form.setValue("removeImage", !previewUrl, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
          <FormDescription>
            PNG, JPEG, or GIF up to {MAX_ROUND_IMAGE_SIZE_MB}MB.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
