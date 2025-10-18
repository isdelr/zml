"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, Info } from "lucide-react";
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
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  limitVotesPerSubmission: z.boolean(),
  maxPositiveVotesPerSubmission: z.coerce.number().min(1).optional(),
  maxNegativeVotesPerSubmission: z.coerce.number().min(0).optional(),
}).superRefine((data, ctx) => {
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
});

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
      limitVotesPerSubmission: (league.limitVotesPerSubmission as boolean) ?? false,
      maxPositiveVotesPerSubmission: (league.maxPositiveVotesPerSubmission as number | undefined),
      maxNegativeVotesPerSubmission: (league.maxNegativeVotesPerSubmission as number | undefined),
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
        {/* Basic Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">Basic Information</h3>
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
                <FormLabel>Description</FormLabel>
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
              <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
                <div className="space-y-0.5">
                  <FormLabel>Public League</FormLabel>
                  <FormDescription>Allow anyone to discover and join this league</FormDescription>
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

        <Separator />

        {/* Time Settings & Voting Rules */}
        <Accordion type="multiple" defaultValue={["timing"]} className="w-full">
          <AccordionItem value="timing" className="border rounded-lg px-4 mb-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">Round Timing & Voting</span>
                <Badge variant="secondary">Important</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                        How long participants have to submit songs
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
                        How long participants have to vote
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
                        Total upvotes each member gets per round
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
                        Total downvotes each member gets per round
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="advanced" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">Advanced Voting Rules</span>
                <Badge variant="outline">Optional</Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Additional voting constraints for more balanced competition</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="limitVotesPerSubmission"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Limit Votes Per Submission</FormLabel>
                      <FormDescription>
                        Prevent members from using all their votes on a single song.
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
                <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/50 p-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="maxPositiveVotesPerSubmission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Upvotes Per Song</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} placeholder="e.g., 3" />
                        </FormControl>
                        <FormDescription>
                          Maximum upvotes one song can receive from a single member
                        </FormDescription>
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
                          <Input type="number" {...field} value={field.value ?? ""} placeholder="e.g., 1" />
                        </FormControl>
                        <FormDescription>
                          Maximum downvotes one song can receive from a single member
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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

  const regularMembers = (league.members as Record<string, unknown>[]) || [];
  const spectators = (league.spectators as Record<string, unknown>[]) || [];
  
  return (
    <div className="space-y-4">
      {/* Regular Members Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Members ({regularMembers.length})
          </h3>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
          {regularMembers.map((member: Record<string, unknown>) => (
            <div
              key={member._id as string}
              className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src={member.image as string | undefined} />
                  <AvatarFallback>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: toSvg(member._id as string, 40),
                      }}
                    />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">{member.name as string}</span>
                  {member._id === league.creatorId && (
                    <Badge variant="secondary" className="w-fit text-xs">Owner</Badge>
                  )}
                </div>
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
      
      {/* Spectators Section */}
      {spectators.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Spectators ({spectators.length})
            </h3>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-2">
            {spectators.map((spectator: Record<string, unknown>) => (
              <div
                key={spectator._id as string}
                className="flex items-center justify-between rounded-md border border-dashed p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={spectator.image as string | undefined} />
                    <AvatarFallback>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: toSvg(spectator._id as string, 40),
                        }}
                      />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">{spectator.name as string}</span>
                    <Badge variant="outline" className="w-fit text-xs">Spectator</Badge>
                  </div>
                </div>
                {currentUser?._id === league.creatorId && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleKick(spectator._id as Id<"users">)}
                  >
                    Kick
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
      {league.inviteCode ? (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Share this link</h3>
            <div className="flex items-center space-x-2">
              <Input 
                id="invite-link" 
                readOnly 
                value={inviteUrl}
                className="font-mono text-sm" 
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  toast.success("Invite link copied!");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Anyone with this link can join your league.
            </p>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Manage Link</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  handleAction("regenerate", {
                    loading: "Generating new link...",
                    success: "New invite link generated. The old link will no longer work.",
                    error: "Failed to generate link.",
                  })
                }
              >
                Regenerate Link
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  handleAction("disable", {
                    loading: "Disabling link...",
                    success: "Invite link disabled. No one can join using this link.",
                    error: "Failed to disable link.",
                  })
                }
              >
                Disable Link
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border bg-muted/50 p-6 text-center">
          <p className="text-muted-foreground">Invite link is currently disabled.</p>
          <p className="text-sm text-muted-foreground">
            Enable it to allow people to join your league via a shareable link.
          </p>
          <Button
            onClick={() =>
              handleAction("enable", {
                loading: "Enabling link...",
                success: "Invite link enabled! Share it with others to let them join.",
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
