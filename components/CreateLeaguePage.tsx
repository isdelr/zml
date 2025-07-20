"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, PlusCircle, Trash2, X } from "lucide-react";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { cn } from "@/lib/utils";

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

const formSchema = z.object({
  name: z.string().min(3, {
    message: "League name must be at least 3 characters.",
  }),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters.",
  }),
  isPublic: z.boolean().default(false),
  submissionDeadline: z.coerce.number().min(1, "Must be at least 1 day."),
  votingDeadline: z.coerce.number().min(1, "Must be at least 1 day."),
  maxPositiveVotes: z.coerce.number().min(1, "Must be at least 1 vote."),
  maxNegativeVotes: z.coerce.number().min(0, "Cannot be negative."),
  rounds: z
    .array(
      z.object({
        title: z.string().min(3, "Title must be at least 3 characters."),
        description: z
          .string()
          .min(10, "Description must be at least 10 characters."),
        imageFile: z.instanceof(File).optional(),
      }),
    )
    .min(1, "You must add at least one round."),
});

export function CreateLeaguePage() {
  const createLeague = useMutation(api.leagues.create);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateLeagueImageUploadUrl,
    syncMetadata: api.files.syncLeagueImageMetadata,
  });
  const router = useRouter();
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const currentTrackIndex = useMusicPlayerStore(
    (state) => state.currentTrackIndex,
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      isPublic: false,
      submissionDeadline: 7,
      votingDeadline: 3,
      maxPositiveVotes: 5,
      maxNegativeVotes: 1,
      rounds: [{ title: "", description: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rounds",
  });

  // Effect to clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(previews).forEach(URL.revokeObjectURL);
    };
  }, [previews]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const processedRounds = await Promise.all(
        values.rounds.map(async (round) => {
          if (round.imageFile) {
            // The hook uploads the file and returns the R2 object key
            const imageKey = await uploadFile(round.imageFile);
            return {
              title: round.title,
              description: round.description,
              imageKey: imageKey,
            };
          } else {
            // If no image, just return the text data
            return {
              title: round.title,
              description: round.description,
            };
          }
        }),
      );

      // Call the createLeague mutation with the processed data
      const leagueId = await createLeague({
        ...values,
        rounds: processedRounds,
      });
      toast.success("League and rounds created successfully!");
      form.reset();
      router.push(`/leagues/${leagueId}`);
    } catch (error) {
      toast.error("Failed to create league. Please try again.");
      console.error(error);
    }
  }

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto bg-background p-8 text-foreground", // Keep existing classes
        currentTrackIndex !== null && "pb-24",
      )}
    >
      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle>Create a New League</CardTitle>
          <CardDescription>
            Define your league's settings and add its initial rounds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* --- League Info Section --- */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">League Information</h3>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>League Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 90s Rock Anthems"
                          {...field}
                        />
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
                        <Textarea
                          placeholder="A league for the best rock of the 90s."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Public League</FormLabel>
                        <FormDescription>
                          Allow anyone to discover and join this league.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* --- Rounds Section --- */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Initial Rounds</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ title: "", description: "" })}
                  >
                    <PlusCircle className="mr-2 size-4" />
                    Add Round
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="relative grid gap-6 rounded-lg border p-4 md:grid-cols-3"
                  >
                    <div className="space-y-4 md:col-span-2">
                      <h4 className="font-semibold">Round {index + 1}</h4>
                      <FormField
                        control={form.control}
                        name={`rounds.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Guilty Pleasures"
                                {...field}
                              />
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
                              <Textarea
                                placeholder="Describe the theme of this round."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={`rounds.${index}.imageFile`}
                      render={({ field: { onChange, value, ...rest } }) => (
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
                                  form.setValue(
                                    `rounds.${index}.imageFile`,
                                    undefined,
                                  );
                                  setPreviews((p) => {
                                    const newPreviews = { ...p };
                                    URL.revokeObjectURL(p[index]); // Clean up old URL
                                    delete newPreviews[index];
                                    return newPreviews;
                                  });
                                }}
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <FormControl>
                              <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                                <ImagePlus className="size-8" />
                                <span className="text-sm font-medium">
                                  Click to upload
                                </span>
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
                                  {...rest}
                                />
                              </label>
                            </FormControl>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-3 -top-3 size-7"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {form.formState.errors.rounds && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.rounds.message}
                  </p>
                )}
              </div>

              {/* --- Rules Section --- */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">League Rules</h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="submissionDeadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Submission Period (Days)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="votingDeadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voting Period (Days)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
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
                          <Input type="number" {...field} />
                        </FormControl>
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
                          <Input type="number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  size="lg"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create League & Rounds"
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
