"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
});

export function CreateLeaguePage() {
  const createLeague = useMutation(api.leagues.create);
  const router = useRouter();

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
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const leagueId = await createLeague(values);
      toast.success("League created successfully!");
      form.reset();
      router.push(`/league/${leagueId}`);
    } catch (error) {
      toast.error("Failed to create league. Please try again.");
      console.error(error);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8 text-foreground">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Create a New League</CardTitle>
          <CardDescription>
            Fill out the details below to start a new music league. You can
            customize the rules and settings here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="A league for the best rock of the 90s."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Give your league a catchy description. This will be
                        visible to potential members if your league is public.
                      </FormDescription>
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
                          Allow anyone to discover and join this league from the
                          Explore page.
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

              {/* Rules Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">League Rules</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="submissionDeadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Submission Period (Days)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          How long members have to submit a track for each
                          round.
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
                        <FormLabel>Voting Period (Days)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          How long members have to vote after submissions close.
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
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          The total number of upvotes each member can cast per
                          round.
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
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          The total number of downvotes each member can cast per
                          round.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  size="lg"
                >
                  {form.formState.isSubmitting
                    ? "Creating..."
                    : "Create League"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
