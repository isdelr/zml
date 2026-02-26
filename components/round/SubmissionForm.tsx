// File: components/round/SubmissionForm.tsx

"use client";

import { SongSubmissionForm } from "@/components/SongSubmissionForm";
import { AlbumSubmissionForm } from "@/components/AlbumSubmissionForm";
import { MultiSongSubmissionForm } from "@/components/MultiSongSubmissionForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Edit } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { EditSubmissionForm } from "@/components/EditSubmissionForm";
import { Doc } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";

type SubmissionWithUrls = Doc<"submissions"> & { albumArtUrl: string | null; songFileUrl: string | null; };

interface SubmissionFormProps {
  round: Doc<"rounds">;
  roundStatus: "voting" | "finished" | "submissions";
  currentUser: Doc<"users"> | null | undefined;
  mySubmissions: SubmissionWithUrls[] | undefined;
  leagueName: string;
}

export function SubmissionForm({
                                 round,
                                 roundStatus,
                                 currentUser,
                                 mySubmissions,
                                 leagueName,
                               }: SubmissionFormProps) {
  const [editingSubmission, setEditingSubmission] = useState<SubmissionWithUrls | null>(null);
  const { actions: playerActions } = useMusicPlayerStore();

  if (currentUser === undefined || mySubmissions === undefined) {
    return null;
  }

  const submissionsPerUser = round.submissionsPerUser ?? 1;
  
  // For album/multi rounds, count unique collections instead of individual tracks
  let submissionCount = mySubmissions.length;
  if (round.submissionMode === "album" || round.submissionMode === "multi") {
    const uniqueCollections = new Set(
      mySubmissions
        .filter(s => s.collectionId)
        .map(s => s.collectionId)
    );
    submissionCount = uniqueCollections.size;
  }
  
  const canSubmitMore = submissionCount < submissionsPerUser;

  const canPlay = (s: { submissionType: string; songFileUrl: string | null; songLink?: string | null; }) => {
    if (s.submissionType === "file") return !!s.songFileUrl;
    return !!s.songLink;
  };

  const handleListen = (submission: SubmissionWithUrls) => {
    if (!canPlay(submission)) return;
    const song = {
      _id: submission._id,
      songTitle: submission.songTitle,
      artist: submission.artist,
      albumArtUrl: submission.albumArtUrl ?? "/icons/web-app-manifest-192x192.png",
      songFileUrl: submission.submissionType === "file" ? submission.songFileUrl : null,
      submissionType: submission.submissionType,
      songLink: submission.submissionType !== "file" ? submission.songLink ?? null : null,
      leagueId: submission.leagueId,
      roundId: submission.roundId,
      comment: submission.comment ?? null,
      submittedBy: currentUser?.name ?? "You",
      roundTitle: round.title,
      leagueName,
      roundStatus,
      lyrics: submission.lyrics ?? null,
    };
    playerActions.playSong(song);
  };


  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">
        Your Submissions ({submissionCount} / {submissionsPerUser})
      </h3>

      {mySubmissions.map((submission) => (
        <Card key={submission._id}>
          <div className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {submission.albumArtUrl && (
                  <Image
                    src={submission.albumArtUrl}
                    alt={submission.songTitle}
                    width={56}
                    height={56}
                    className="rounded shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{submission.songTitle}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {submission.artist}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {roundStatus === "submissions" && (
                  <Button variant="outline" onClick={() => setEditingSubmission(submission)}>
                    <Edit className="mr-2 size-4" />
                    Edit
                  </Button>
                )}
                {roundStatus === "submissions" && (
                  <Button variant="secondary" onClick={() => handleListen(submission)} disabled={!canPlay(submission)}>
                    Listen
                  </Button>
                )}
              </div>
            </div>
            {submission.comment && (
              <blockquote className="mt-4 border-l-2 pl-3 text-sm italic text-muted-foreground">
                {submission.comment}
              </blockquote>
            )}
          </div>
        </Card>
      ))}


      {canSubmitMore && roundStatus === "submissions" && (
        round.submissionMode === "album" ? (
          <AlbumSubmissionForm round={round} />
        ) : round.submissionMode === "multi" ? (
          <MultiSongSubmissionForm 
            round={round}
            maxSongs={submissionsPerUser} 
            currentCount={submissionCount} 
          />
        ) : (
          <SongSubmissionForm round={round} />
        )
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
