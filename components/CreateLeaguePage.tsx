"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { api } from "@/lib/convex/api";
import { useUploadFile } from "@/lib/storage/useUploadFile";
import {
  createLeagueFormSchema,
  defaultCreateLeagueFormValues,
  type CreateLeagueFormValues,
} from "@/lib/leagues/create-league-form";
import { LeagueBasicInfoSection } from "@/components/league/create/LeagueBasicInfoSection";
import { LeagueRoundsSection } from "@/components/league/create/LeagueRoundsSection";
import { LeagueRulesAccordion } from "@/components/league/create/LeagueRulesAccordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";

export function CreateLeaguePage() {
  const createLeague = useMutation(api.leagues.create);
  const uploadFile = useUploadFile({
    generateUploadUrl: api.files.generateLeagueImageUploadUrl,
    syncMetadata: api.files.syncLeagueImageMetadata,
  });
  const router = useRouter();
  const [previews, setPreviews] = useState<Record<number, string>>({});

  const form = useForm<
    z.input<typeof createLeagueFormSchema>,
    unknown,
    CreateLeagueFormValues
  >({
    resolver: zodResolver(createLeagueFormSchema),
    defaultValues: defaultCreateLeagueFormValues,
  });

  useEffect(() => {
    return () => {
      Object.values(previews).forEach(URL.revokeObjectURL);
    };
  }, [previews]);

  async function onSubmit(values: CreateLeagueFormValues) {
    const toastId = toast.loading("Creating your league...");
    try {
      const processedRounds = await Promise.all(
        values.rounds.map(async (round) => {
          let imageKey: string | undefined;
          if (round.imageFile) {
            imageKey = await uploadFile(round.imageFile);
          }
          return {
            title: round.title,
            description: round.description,
            submissionsPerUser: round.submissionsPerUser,
            genres: round.genres ?? [],
            imageKey,
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
    <div className="min-h-full bg-background p-4 text-foreground md:p-8">
      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle>Create a New League</CardTitle>
          <CardDescription>
            Define your league&apos;s settings and add its initial rounds. Start with the basics and
            expand the advanced sections as needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <LeagueBasicInfoSection form={form} />

              <Separator className="my-6" />

              <LeagueRoundsSection form={form} previews={previews} setPreviews={setPreviews} />

              <Separator className="my-6" />

              <LeagueRulesAccordion form={form} />

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
