"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "../ui/separator";

const leagueEditSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters."),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters."),
  isPublic: z.boolean(),
  submissionDeadline: z.coerce.number().min(1, "Must be at least 1 hour.").max(720, "Max duration is 30 days (720 hours)."),
  votingDeadline: z.coerce.number().min(1, "Must be at least 1 hour.").max(720, "Max duration is 30 days (720 hours)."),
  maxPositiveVotes: z.coerce.number().min(1),
  maxNegativeVotes: z.coerce.number().min(0),
  // --- NEW FIELDS START ---
  limitVotesPerSubmission: z.boolean(),
  maxPositiveVotesPerSubmission: z.coerce.number().min(1).optional(),
  maxNegativeVotesPerSubmission: z.coerce.number().min(0).optional(),
  // --- NEW FIELDS END ---
}).superRefine((data, ctx) => { // --- NEW VALIDATION START ---
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
}); // --- NEW VALIDATION END ---

interface LeagueSettingsDialogProps {
  league: Record<string, unknown>;
  currentUser: Record<string, unknown>;
  onClose: () => void;
}

export function LeagueSettingsDialog({
                                       league,
                                       currentUser,
                                       onClose,
                                     }: LeagueSettingsDialogProps) {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="invite">Invite Link</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Update your league&apos;s name, description, and rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsTab league={league} onClose={onClose} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="members">
        <Card>
          <CardHeader>
            <CardTitle>Manage Members</CardTitle>
            <CardDescription>
              View and remove members from your league.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembersTab league={league} currentUser={currentUser} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="invite">
        <Card>
          <CardHeader>
            <CardTitle>Invite Link</CardTitle>
            <CardDescription>
              Manage how people can join your league.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteTab league={league} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function GeneralSettingsTab({
                              league,
                              onClose,
                            }: {
  league: Record<string, unknown>;
  onClose: () => void;
}) {
  const updateLeague = useMutation(api.leagues.updateLeague);
  const form = useForm({
    resolver: zodResolver(leagueEditSchema),
    defaultValues: {
      name: league.name as string,
      description: league.description as string,
      isPublic: league.isPublic as boolean,
      submissionDeadline: league.submissionDeadline as number,
      votingDeadline: league.votingDeadline as number,
      maxPositiveVotes: league.maxPositiveVotes as number,
      maxNegativeVotes: league.maxNegativeVotes as number,
      // --- NEW DEFAULTS START ---
      limitVotesPerSubmission: (league.limitVotesPerSubmission as boolean) ?? false,
      maxPositiveVotesPerSubmission: (league.maxPositiveVotesPerSubmission as number | undefined),
      maxNegativeVotesPerSubmission: (league.maxNegativeVotesPerSubmission as number | undefined),
      // --- NEW DEFAULTS END ---
    },
  });

  async function onSubmit(values: z.infer<typeof leagueEditSchema>) {
    toast.promise(
      updateLeague({ leagueId: league._id as Id<"leagues">, ...values }),
      {
        loading: "Updating league...",
        success: (msg) => {
          onClose();
          return msg;
        },
        error: "Failed to update league.",
      },
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>League Name</FormLabel>
              <FormControl>
                <Input {...field} />
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
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isPublic"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <FormLabel>Public League</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="submissionDeadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Submission Period (Hours)</FormLabel>
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
                <FormLabel>Voting Period (Hours)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        {/* --- NEW SECTION START --- */}
        <Separator />
        <FormField
          control={form.control}
          name="limitVotesPerSubmission"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Limit Votes Per Submission</FormLabel>
                <FormDescription>
                  Set a max for how many votes a member can give one song.
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
        {form.watch("limitVotesPerSubmission") && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="maxPositiveVotesPerSubmission"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Upvotes/Song</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ""} />
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
                  <FormLabel>Max Downvotes/Song</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        {/* --- NEW SECTION END --- */}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}

function MembersTab({
                      league,
                      currentUser,
                    }: {
  league: Record<string, unknown>;
  currentUser: Record<string, unknown>;
}) {
  const kickMember = useMutation(api.leagues.kickMember);

  const handleKick = (memberIdToKick: Id<"users">) => {
    toast.promise(
      kickMember({ leagueId: league._id as Id<"leagues">, memberIdToKick }),
      {
        loading: "Kicking member...",
        success: "Member kicked.",
        error: (err) => err.data?.message || "Failed to kick member.",
      },
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">League Members</h3>
      <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
        {league.members.map((member: Record<string, unknown>) => (
          <div
            key={member._id as string}
            className="flex items-center justify-between rounded-md border p-2"
          >
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarImage src={member.image as string | undefined} />
                <AvatarFallback>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: toSvg(member._id as string, 32),
                    }}
                  />
                </AvatarFallback>
              </Avatar>
              <span>{member.name}</span>
              {member._id === league.creatorId && (
                <span className="text-xs text-yellow-500">(Owner)</span>
              )}
            </div>
            {currentUser?._id === league.creatorId &&
              member._id !== league.creatorId && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleKick(member._id as Id<"users">)}
                >
                  Kick
                </Button>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InviteTab({ league }: { league: Record<string, unknown> }) {
  const manageInviteCode = useMutation(api.leagues.manageInviteCode);

  const handleAction = (
    action: "regenerate" | "disable" | "enable",
    messages: { loading: string; success: string; error: string },
  ) => {
    toast.promise(
      manageInviteCode({ leagueId: league._id as Id<"leagues">, action }),
      {
        loading: messages.loading,
        success: messages.success,
        error: (err) => err.data?.message || messages.error,
      },
    );
  };

  const inviteUrl =
    league.inviteCode && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${league.inviteCode}`
      : "";

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Manage Invite Link</h3>
      {league.inviteCode ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input id="invite-link" readOnly value={inviteUrl} />
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                toast.success("Invite link copied!");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                handleAction("regenerate", {
                  loading: "Generating new link...",
                  success: "New invite link generated.",
                  error: "Failed to generate link.",
                })
              }
            >
              Regenerate
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                handleAction("disable", {
                  loading: "Disabling link...",
                  success: "Invite link disabled.",
                  error: "Failed to disable link.",
                })
              }
            >
              Disable Link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground">Invite link is disabled.</p>
          <Button
            onClick={() =>
              handleAction("enable", {
                loading: "Enabling link...",
                success: "New invite link enabled.",
                error: "Failed to enable link.",
              })
            }
          >
            Enable Invite Link
          </Button>
        </div>
      )}
    </div>
  );
}