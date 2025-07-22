"use client";

import { SongSubmissionForm } from "@/components/SongSubmissionForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { EditSubmissionForm } from "@/components/EditSubmissionForm";
import { Id } from "@/convex/_generated/dataModel";

interface SubmissionFormProps {
  roundId: Id<"rounds">;
  currentUser: unknown;
  submissions: unknown[] | undefined;
  mySubmission: unknown;
}

export function SubmissionForm({
  roundId,
  currentUser,
  submissions,
  mySubmission,
}: SubmissionFormProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  if (currentUser === undefined || submissions === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (mySubmission) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Your Submission</h3>
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {mySubmission.albumArtUrl && (
                  <Image
                    src={mySubmission.albumArtUrl}
                    alt={mySubmission.songTitle}
                    width={56}
                    height={56}
                    className="rounded"
                  />
                )}
                <div>
                  <p className="font-semibold">
                    {mySubmission.songTitle}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {mySubmission.artist}
                  </p>
                </div>
              </div>
              <Dialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Edit className="mr-2 size-4" />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Your Submission</DialogTitle>
                  </DialogHeader>
                  <EditSubmissionForm
                    submission={mySubmission}
                    onSubmitted={() => setIsEditDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
            {mySubmission.comment && (
              <blockquote className="mt-4 border-l-2 pl-3 text-sm italic text-muted-foreground">
                {mySubmission.comment}
              </blockquote>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return <SongSubmissionForm roundId={roundId} />;
}