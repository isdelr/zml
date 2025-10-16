"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, PlusCircle, Trash2, X, Info, ChevronRight } from "lucide-react";
import { genres } from "@/lib/genres";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useUploadFile } from "@convex-dev/r2/react";
import { Badge } from "./ui/badge";
import { toSvg } from "jdenticon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MAX_ROUND_IMAGE_SIZE_MB = 5;
const MAX_ROUND_IMAGE_SIZE_BYTES = MAX_ROUND_IMAGE_SIZE_MB * 1024 * 1024;

const formSchema = z
    .object({
      name: z.string().min(3, {
        message: "League name must be at least 3 characters.",
      }),
      description: z.string().min(10, {
        message: "Description must be at least 10 characters.",
      }),
      isPublic: z.boolean().default(false),
      submissionDeadline: z.coerce.number().min(1, "Must be at least 1 hour.").max(720, "Max duration is 30 days (720 hours)."),
      votingDeadline: z.coerce.number().min(1, "Must be at least 1 hour.").max(720, "Max duration is 30 days (720 hours)."),
      maxPositiveVotes: z.coerce.number().min(1, "Must be at least 1 vote."),
      maxNegativeVotes: z.coerce.number().min(0, "Cannot be negative."),
      limitVotesPerSubmission: z.boolean().default(false),
      maxPositiveVotesPerSubmission: z.coerce.number().min(1, "Must be at least 1 vote.").optional(),
      maxNegativeVotesPerSubmission: z.coerce.number().min(0, "Cannot be negative.").optional(),
      enforceListenPercentage: z.boolean().default(false),
      listenPercentage: z.coerce.number().min(1, "Must be between 1-100%").max(100, "Must be between 1-100%").optional(),
      listenTimeLimitMinutes: z.coerce.number().min(1, "Must be at least 1 minute.").optional(),
      rounds: z
        .array(
          z.object({
            title: z.string().min(3, "Title must be at least 3 characters."),
            description: z.string().min(10, "Description must be at least 10 characters."),
            submissionsPerUser: z.coerce.number().min(1, "Must be at least 1.").max(5, "Max 5 submissions."),
            genres: z.array(z.string()).optional(),
            imageFile: z
              .instanceof(File)
              .optional()
              .refine(
                (file) => !file || file.size <= MAX_ROUND_IMAGE_SIZE_BYTES,
                `Image must be less than ${MAX_ROUND_IMAGE_SIZE_MB}MB.`,
              ),
            submissionMode: z.enum(["single", "multi", "album"]).default("single"),
            submissionInstructions: z.string().optional(),
            albumConfig: z
              .object({
                allowPartial: z.boolean().optional(),
                requireReleaseYear: z.boolean().optional(),
                minTracks: z.coerce.number().min(1, "Must be at least 1 track.").optional(),
                maxTracks: z.coerce.number().min(1, "Must be at least 1 track.").optional(),
              })
              .optional(),
          }),
        )
        .min(1, "You must add at least one round."),
})
.superRefine((data, ctx) => {
  if (data.enforceListenPercentage) {
    if (data.listenPercentage === undefined || isNaN(data.listenPercentage)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A percentage is required.",
        path: ["listenPercentage"],
      });
    }
    if (data.listenTimeLimitMinutes === undefined || isNaN(data.listenTimeLimitMinutes)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A time limit is required.",
        path: ["listenTimeLimitMinutes"],
      });
    }
  }
  if (data.limitVotesPerSubmission) {
    if (data.maxPositiveVotesPerSubmission === undefined || isNaN(data.maxPositiveVotesPerSubmission)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A max is required.",
        path: ["maxPositiveVotesPerSubmission"],
      });
    }
    if (data.maxNegativeVotesPerSubmission === undefined || isNaN(data.maxNegativeVotesPerSubmission)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A max is required.",
        path: ["maxNegativeVotesPerSubmission"],
      });
    }
  }
  // Validate album config for each round
  data.rounds.forEach((round, index) => {
    if (round.submissionMode === "album" && round.albumConfig) {
      const { minTracks, maxTracks } = round.albumConfig;
      if (minTracks !== undefined && maxTracks !== undefined && minTracks > maxTracks) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Minimum tracks cannot exceed maximum tracks.",
          path: ["rounds", index, "albumConfig", "minTracks"],
        });
      }
    }
  });
});

export function CreateLeaguePage() {
  const createLeague = useMutation(api.leagues.create);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateLeagueImageUploadUrl,
    syncMetadata: api.files.syncLeagueImageMetadata,
  });
  const router = useRouter();
  const [previews, setPreviews] = useState<Record<number, string>>({});

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      isPublic: false,
      submissionDeadline: 168,
      votingDeadline: 72,
      maxPositiveVotes: 5,
      maxNegativeVotes: 1,
      limitVotesPerSubmission: false,
      enforceListenPercentage: false,
      rounds: [{
        title: "",
        description: "",
        genres: [],
        submissionsPerUser: 1,
        submissionMode: "single" as const,
        submissionInstructions: "",
        albumConfig: {
          allowPartial: false,
          requireReleaseYear: true,
          minTracks: undefined,
          maxTracks: undefined,
        },
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rounds",
  });

  useEffect(() => {
    return () => {
      Object.values(previews).forEach(URL.revokeObjectURL);
    };
  }, [previews]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const toastId = toast.loading("Creating your league...");
    try {
      const processedRounds = await Promise.all(
        values.rounds.map(async (round) => {
          let imageKey: string | undefined = undefined;
          if (round.imageFile) {
            imageKey = await uploadFile(round.imageFile);
          }
          return {
            title: round.title,
            description: round.description,
            submissionsPerUser: round.submissionsPerUser,
            genres: round.genres ?? [],
            imageKey: imageKey,
            submissionMode: round.submissionMode,
            submissionInstructions: round.submissionInstructions,
            albumConfig: round.albumConfig,
          };
        }),
      );
      const leagueId = await createLeague({
        ...values,
        rounds: processedRounds,
      });
      toast.success("League and rounds created successfully!", { id: toastId });
      form.reset();
      router.push(`/leagues/${leagueId}`);
    } catch {
      toast.error("Failed to create league. Please try again.", {
        id: toastId,
      });
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 text-foreground md:p-8">
      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle>Create a New League</CardTitle>
          <CardDescription>
            Define your league&apos;s settings and add its initial rounds. Start with the basics and expand the advanced sections as needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic League Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  <Badge variant="secondary">Required</Badge>
                </div>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>League Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 90s Rock Anthems" {...field} />
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
                      <FormLabel>League Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe what this league is about..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Public League</FormLabel>
                        <FormDescription>Allow anyone to discover and join this league in the explore page.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="my-6" />

              {/* Rounds Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Rounds</h3>
                    <Badge variant="secondary">Required</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        title: "",
                        description: "",
                        genres: [],
                        submissionsPerUser: 1,
                        submissionMode: "single" as const,
                        submissionInstructions: "",
                        albumConfig: {
                          allowPartial: false,
                          requireReleaseYear: true,
                          minTracks: undefined,
                          maxTracks: undefined,
                        },
                      })
                    }
                  >
                    <PlusCircle className="mr-2 size-4" />
                    Add Round
                  </Button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="relative">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Round {index + 1}</CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col-reverse gap-6 md:flex-row">
                          <div className="flex-1 space-y-4">
                            {/* Basic Round Info */}
                            <FormField
                              control={form.control}
                              name={`rounds.${index}.title`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Round Title</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., Guilty Pleasures" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`rounds.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Describe the theme of this round." {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`rounds.${index}.submissionsPerUser`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Songs per Participant</FormLabel>
                                  <FormControl>
                                    <Input type="number" min={1} max={5} {...field} value={(field.value as number) || ""} />
                                  </FormControl>
                                  <FormDescription>
                                    How many songs each participant can submit (1-5)
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Round Image */}
                          <div className="w-full md:w-52">
                            <FormField
                              control={form.control}
                              name={`rounds.${index}.imageFile`}
                              render={({ field: { onChange, ...rest } }) => (
                                <FormItem>
                                  <FormLabel>Round Image (Optional)</FormLabel>
                                  {previews[index] ? (
                                    <div className="relative">
                                      <Image
                                        src={previews[index]}
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
                                          setPreviews((p) => {
                                            const newPreviews = { ...p };
                                            URL.revokeObjectURL(p[index]);
                                            delete newPreviews[index];
                                            return newPreviews;
                                          });
                                        }}
                                      >
                                        <X className="size-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="relative aspect-square w-full rounded-md bg-muted">
                                      <div
                                        className="flex size-full items-center justify-center"
                                        dangerouslySetInnerHTML={{
                                          __html: toSvg(
                                            form.getValues(`rounds.${index}.title`) || `round-${index}`,
                                            200,
                                          ),
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
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                onChange(file);
                                                setPreviews((p) => ({
                                                  ...p,
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
                          </div>
                        </div>

                        {/* Advanced Round Options in Accordion */}
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="advanced" className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Advanced Options</span>
                                <Badge variant="outline" className="text-xs">Optional</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                              <FormField
                                control={form.control}
                                name={`rounds.${index}.submissionMode`}
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
                                        <SelectItem value="single">Single song per submission</SelectItem>
                                        <SelectItem value="multi">Multiple songs per round (shuffled)</SelectItem>
                                        <SelectItem value="album">Album round (keep track order)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormDescription>
                                      Choose how submissions should be grouped and presented.
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={form.control}
                                name={`rounds.${index}.submissionInstructions`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Submission Instructions</FormLabel>
                                    <FormControl>
                                      <Textarea
                                        placeholder="e.g., Submit your favorite 3 tracks from the 90s..."
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Additional guidance shown to participants when submitting.
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {form.watch(`rounds.${index}.submissionMode`) === "album" && (
                                <div className="space-y-4 rounded-md border bg-muted/50 p-4">
                                  <h4 className="text-sm font-semibold text-muted-foreground">
                                    Album Round Settings
                                  </h4>
                                  <FormField
                                    control={form.control}
                                    name={`rounds.${index}.albumConfig.allowPartial`}
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
                                        <div className="space-y-0.5">
                                          <FormLabel>Allow partial albums</FormLabel>
                                          <FormDescription>
                                            Participants can submit only a selection of tracks.
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
                                    name={`rounds.${index}.albumConfig.requireReleaseYear`}
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
                                        <div className="space-y-0.5">
                                          <FormLabel>Require album release year</FormLabel>
                                          <FormDescription>
                                            Ensure submissions include the album&apos;s release year.
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
                                      name={`rounds.${index}.albumConfig.minTracks`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Minimum Tracks</FormLabel>
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
                                      name={`rounds.${index}.albumConfig.maxTracks`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Maximum Tracks</FormLabel>
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

                              <FormField
                                control={form.control}
                                name={`rounds.${index}.genres`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Genres (Optional)</FormLabel>
                                    <FormDescription>Click on genres to select or unselect them.</FormDescription>
                                    <FormControl>
                                      <div className="flex flex-wrap gap-2">
                                        {genres.map((genre) => (
                                          <Badge
                                            key={genre}
                                            variant={field.value?.includes(genre) ? "default" : "outline"}
                                            onClick={() => {
                                              const newValue = field.value ?? [];
                                              const newSelected = newValue.includes(genre)
                                                ? newValue.filter((g: string) => g !== genre)
                                                : [...newValue, genre];
                                              field.onChange(newSelected);
                                            }}
                                            className="cursor-pointer"
                                          >
                                            {genre}
                                          </Badge>
                                        ))}
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {form.formState.errors.rounds && (
                  <p className="text-sm font-medium text-destructive">
                    {(form.formState.errors.rounds as { message?: string }).message}
                  </p>
                )}
              </div>

              <Separator className="my-6" />

              {/* League Rules in Accordion */}
              <Accordion type="multiple" className="w-full">
                {/* Basic Voting Rules */}
                <AccordionItem value="voting" className="border rounded-lg px-4 mb-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">Voting Rules</span>
                      <Badge variant="secondary">Recommended</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="submissionDeadline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Submission Period (Hours)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={(field.value as number) || ""} />
                            </FormControl>
                            <FormDescription>
                              Default: 7 days (168 hours)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="votingDeadline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Voting Period (Hours)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={(field.value as number) || ""} />
                            </FormControl>
                            <FormDescription>
                              Default: 3 days (72 hours)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="maxPositiveVotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Upvotes per Member</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={(field.value as number) || ""} />
                            </FormControl>
                            <FormDescription>
                              How many upvotes each member gets per round
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
                            <FormLabel>Downvotes per Member</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} value={(field.value as number) || ""} />
                            </FormControl>
                            <FormDescription>
                              How many downvotes each member gets per round
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Advanced Options */}
                <AccordionItem value="advanced" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">Advanced Options</span>
                      <Badge variant="outline">Optional</Badge>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="size-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>These settings are optional and add extra rules</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pt-4">
                    {/* Limit Votes Per Submission */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="limitVotesPerSubmission"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Limit Votes Per Submission</FormLabel>
                              <FormDescription>
                                Prevent members from using all their votes on a single song.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {form.watch("limitVotesPerSubmission") && (
                        <div className="grid grid-cols-1 gap-6 rounded-lg border bg-muted/50 p-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="maxPositiveVotesPerSubmission"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Upvotes Per Song</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="e.g., 3"
                                    {...field}
                                    value={(field.value as number) || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="maxNegativeVotesPerSubmission"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Downvotes Per Song</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="e.g., 1"
                                    {...field}
                                    value={(field.value as number) || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Enforce Listen Duration */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="enforceListenPercentage"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Enforce Listen Duration</FormLabel>
                              <FormDescription>
                                Require participants to listen to a portion of each song before voting.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {form.watch("enforceListenPercentage") && (
                        <div className="grid grid-cols-1 gap-6 rounded-lg border bg-muted/50 p-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="listenPercentage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Listen Percentage (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="e.g., 50"
                                    {...field}
                                    value={(field.value as number) || ""}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Percentage of song that must be played
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="listenTimeLimitMinutes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Time Limit (Minutes)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="e.g., 30"
                                    {...field}
                                    value={(field.value as number) || ""}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Maximum time to count towards listen requirement
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Separator className="my-6" />
              
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting} size="lg">
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create League"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
