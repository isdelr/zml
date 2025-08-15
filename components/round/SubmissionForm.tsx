// components/round/SubmissionForm.tsx
"use client";

import { SongSubmissionForm } from "@/components/SongSubmissionForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { EditSubmissionForm } from "@/components/EditSubmissionForm";
import { Doc } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FaSpotify, FaYoutube } from "react-icons/fa";

type SubmissionWithUrls = Doc<"submissions"> & { albumArtUrl: string | null; songFileUrl: string | null; };

interface SubmissionFormProps {
  round: Doc<"rounds">;
  roundStatus: "voting" | "finished" | "submissions";
  currentUser: Doc<"users"> | null | undefined;
  mySubmissions: SubmissionWithUrls[] | undefined;
}

export function SubmissionForm({
                                 round,
                                 roundStatus,
                                 currentUser,
                                 mySubmissions,
                               }: SubmissionFormProps) {
  const [editingSubmission, setEditingSubmission] = useState<SubmissionWithUrls | null>(null);
  const myPresubmissions = useQuery(api.submissions.getMyPresubmissionForRound, { roundId: round._id });

  if (currentUser === undefined || mySubmissions === undefined || myPresubmissions === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  const submissionsPerUser = round.submissionsPerUser ?? 1;
  const canSubmitMore = mySubmissions.length + (myPresubmissions?.length ?? 0) < submissionsPerUser;

  const PresubmissionItem = ({ pre }: { pre: NonNullable<typeof myPresubmissions>[0] }) => (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {pre.albumArtUrl && (
              <Image
                src={pre.albumArtUrl}
                alt={pre.songTitle}
                width={56}
                height={56}
                className="rounded"
              />
            )}
            <div>
              <p className="font-semibold">{pre.songTitle}</p>
              <p className="text-sm text-muted-foreground">{pre.artist}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {pre.submissionType === "spotify" && <FaSpotify />}
            {pre.submissionType === "youtube" && <FaYoutube />}
          </div>
        </div>
        {pre.comment && (
          <blockquote className="mt-4 border-l-2 pl-3 text-sm italic text-muted-foreground">
            {pre.comment}
          </blockquote>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          This track will be auto-submitted when the round opens for submissions.
        </p>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">
        Your Submissions ({mySubmissions.length + (myPresubmissions?.length ?? 0)} / {submissionsPerUser})
      </h3>

      {mySubmissions.map((submission) => (
        <Card key={submission._id}>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {submission.albumArtUrl && (
                  <Image
                    src={submission.albumArtUrl}
                    alt={submission.songTitle}
                    width={56}
                    height={56}
                    className="rounded"
                  />
                )}
                <div>
                  <p className="font-semibold">{submission.songTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {submission.artist}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setEditingSubmission(submission)}>
                <Edit className="mr-2 size-4" />
                Edit
              </Button>
            </div>
            {submission.comment && (
              <blockquote className="mt-4 border-l-2 pl-3 text-sm italic text-muted-foreground">
                {submission.comment}
              </blockquote>
            )}
          </div>
        </Card>
      ))}

      {myPresubmissions?.map((pre) => <PresubmissionItem key={pre._id} pre={pre} />)}

      {canSubmitMore && (
        <SongSubmissionForm roundId={round._id} isPresubmit={roundStatus !== "submissions"} />
      )}

      <Dialog open={!!editingSubmission} onOpenChange={(isOpen) => !isOpen && setEditingSubmission(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Your Submission</DialogTitle>
          </DialogHeader>
          {editingSubmission && (
            <EditSubmissionForm
              submission={editingSubmission}
              onSubmitted={() => setEditingSubmission(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}