// File: components/round/SubmissionForm.tsx

"use client";

import { AlbumSubmissionForm } from "@/components/AlbumSubmissionForm";
import { EditSubmissionForm } from "@/components/EditSubmissionForm";
import { MultiSongSubmissionForm } from "@/components/MultiSongSubmissionForm";
import { SongSubmissionForm } from "@/components/SongSubmissionForm";
import { SubmissionProcessingStatus } from "@/components/submission/SubmissionProcessingStatus";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Doc } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { buildTrackMetadataText } from "@/lib/music/submission-display";
import { willSubmissionImmediatelyStartVoting } from "@/lib/rounds/auto-voting-warning";
import { getUserSubmissionCompletionCount } from "@/lib/rounds/submission-completion";
import {
  getSubmissionFileProcessingStatus,
  hasPendingSubmissionProcessing,
  isSubmissionPlayable,
} from "@/lib/submission/file-processing";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@/lib/utils";
import { ChevronDown, Edit, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type SubmissionWithUrls = Doc<"submissions"> & {
  albumArtUrl: string | null;
  songFileUrl: string | null;
};

const EMPTY_SUBMISSIONS: SubmissionWithUrls[] = [];
const FALLBACK_ALBUM_ART = "/icons/web-app-manifest-192x192.png";

interface SubmissionFormProps {
  round: Doc<"rounds">;
  roundStatus: "scheduled" | "voting" | "finished" | "submissions";
  currentUser: Doc<"users"> | null | undefined;
  mySubmissions: SubmissionWithUrls[] | undefined;
  allSubmissions: SubmissionWithUrls[] | undefined;
  activeMemberCount: number;
  leagueName: string;
}

interface SubmissionRowProps {
  index: number;
  roundStatus: SubmissionFormProps["roundStatus"];
  submission: SubmissionWithUrls;
  onEdit: (submission: SubmissionWithUrls) => void;
  onListen: (submission: SubmissionWithUrls) => void;
  playable: boolean;
}

function MySubmissionRow({
  index,
  roundStatus,
  submission,
  onEdit,
  onListen,
  playable,
}: SubmissionRowProps) {
  const metadataText = buildTrackMetadataText(
    submission.artist,
    submission.albumName,
    submission.year,
  );
  const canEdit =
    roundStatus === "scheduled" || roundStatus === "submissions";

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="p-3 transition-colors hover:bg-accent/40">
        <div className="md:hidden">
          <div className="flex items-center gap-3">
            <MediaImage
              src={submission.albumArtUrl ?? FALLBACK_ALBUM_ART}
              alt={submission.songTitle}
              width={48}
              height={48}
              className="shrink-0 rounded"
              fallbackSrc={FALLBACK_ALBUM_ART}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{submission.songTitle}</p>
              {metadataText ? (
                <p className="truncate text-sm text-muted-foreground">
                  {metadataText}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <SubmissionProcessingStatus submission={submission} compact />

            <div className="flex items-center gap-2">
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(submission)}
                >
                  <Edit className="size-4" />
                  Edit
                </Button>
              ) : null}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onListen(submission)}
                disabled={!playable}
              >
                <Play className="size-4" />
                {submission.submissionType === "file" && !playable
                  ? "Waiting"
                  : "Listen"}
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-4 md:grid md:grid-cols-[auto_4fr_2fr_auto]">
          <div className="flex w-10 items-center justify-center text-sm text-muted-foreground">
            {index + 1}
          </div>

          <div className="flex min-w-0 items-center gap-4">
            <MediaImage
              src={submission.albumArtUrl ?? FALLBACK_ALBUM_ART}
              alt={submission.songTitle}
              width={40}
              height={40}
              className="shrink-0 rounded"
              fallbackSrc={FALLBACK_ALBUM_ART}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">{submission.songTitle}</p>
              {metadataText ? (
                <p className="truncate text-sm text-muted-foreground">
                  {metadataText}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <SubmissionProcessingStatus submission={submission} compact />
          </div>

          <div className="flex items-center justify-end gap-2">
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(submission)}
              >
                <Edit className="size-4" />
                Edit
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onListen(submission)}
              disabled={!playable}
            >
              <Play className="size-4" />
              {submission.submissionType === "file" && !playable
                ? "Waiting"
                : "Listen"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubmissionForm({
  round,
  roundStatus,
  currentUser,
  mySubmissions,
  allSubmissions,
  activeMemberCount,
  leagueName,
}: SubmissionFormProps) {
  const [editingSubmission, setEditingSubmission] =
    useState<SubmissionWithUrls | null>(null);
  const [isMultiExpanded, setIsMultiExpanded] = useState(false);
  const { actions: playerActions } = useMusicPlayerStore();
  const previousStatusesRef = useRef<Record<string, string>>({});
  const resolvedSubmissions = mySubmissions ?? EMPTY_SUBMISSIONS;
  const resolvedAllSubmissions = allSubmissions ?? EMPTY_SUBMISSIONS;

  const submissionsPerUser = round.submissionsPerUser ?? 1;
  const submissionMode = round.submissionMode ?? "single";
  const submissionCount =
    currentUser !== null && currentUser !== undefined
      ? getUserSubmissionCompletionCount(
          resolvedSubmissions,
          submissionMode,
          currentUser._id,
        )
      : 0;

  const canSubmitMore = submissionCount < submissionsPerUser;
  const hasMultipleTracks = resolvedSubmissions.length > 1;
  const isExpanded = !hasMultipleTracks || isMultiExpanded;
  const canEditSubmissions =
    roundStatus === "scheduled" || roundStatus === "submissions";

  const canPlay = (submission: SubmissionWithUrls) =>
    isSubmissionPlayable({
      submissionType: submission.submissionType,
      songFileKey: submission.songFileKey ?? null,
      songLink: submission.songLink ?? null,
      fileProcessingStatus: submission.fileProcessingStatus,
    });

  const pendingProcessingCount = useMemo(() => {
    return resolvedSubmissions.filter((submission) =>
      hasPendingSubmissionProcessing({
        submissionType: submission.submissionType,
        songFileKey: submission.songFileKey ?? null,
        fileProcessingStatus: submission.fileProcessingStatus,
      }),
    ).length;
  }, [resolvedSubmissions]);

  const submittedTitlesSummary = useMemo(() => {
    return resolvedSubmissions
      .map((submission) => submission.songTitle.trim())
      .filter(Boolean)
      .join(", ");
  }, [resolvedSubmissions]);
  const hasIncompleteFileSubmissions = useMemo(() => {
    return resolvedAllSubmissions.some((submission) => {
      if (submission.submissionType !== "file") {
        return false;
      }

      return (
        getSubmissionFileProcessingStatus({
          submissionType: submission.submissionType,
          songFileKey: submission.songFileKey ?? null,
          fileProcessingStatus: submission.fileProcessingStatus,
        }) !== "ready"
      );
    });
  }, [resolvedAllSubmissions]);
  const willAutoStartVotingOnLinkSubmit = useMemo(() => {
    if (!currentUser) {
      return false;
    }

    return willSubmissionImmediatelyStartVoting({
      roundStatus,
      isFirstRound: (round.order ?? -1) === 0,
      submissionMode,
      submissionsPerUser,
      activeMemberCount,
      currentUserId: currentUser._id,
      submissions: resolvedAllSubmissions,
      additionalSubmissionUnits: 1,
      hasIncompleteFileSubmissions,
    });
  }, [
    activeMemberCount,
    currentUser,
    hasIncompleteFileSubmissions,
    resolvedAllSubmissions,
    round.order,
    roundStatus,
    submissionMode,
    submissionsPerUser,
  ]);

  useEffect(() => {
    const nextStatuses: Record<string, string> = {};

    for (const submission of resolvedSubmissions) {
      const status = getSubmissionFileProcessingStatus({
        submissionType: submission.submissionType,
        songFileKey: submission.songFileKey ?? null,
        fileProcessingStatus: submission.fileProcessingStatus,
      });
      const key = submission._id.toString();
      const previousStatus = previousStatusesRef.current[key];

      if (previousStatus && previousStatus !== status) {
        if (status === "ready") {
          toast.success(`"${submission.songTitle}" is ready for playback.`);
        } else if (status === "failed") {
          toast.error(`"${submission.songTitle}" needs a new upload.`);
        }
      }

      nextStatuses[key] = status;
    }

    previousStatusesRef.current = nextStatuses;
  }, [resolvedSubmissions]);

  if (currentUser === undefined || mySubmissions === undefined) {
    return null;
  }

  const handleListen = (submission: SubmissionWithUrls) => {
    if (!canPlay(submission)) return;

    playerActions.playSong({
      _id: submission._id,
      songTitle: submission.songTitle,
      artist: submission.artist,
      albumName: submission.albumName ?? null,
      albumArtUrl: submission.albumArtUrl ?? FALLBACK_ALBUM_ART,
      songFileUrl:
        submission.submissionType === "file" ? submission.songFileUrl : null,
      submissionType: submission.submissionType,
      songLink:
        submission.submissionType !== "file"
          ? (submission.songLink ?? null)
          : null,
      leagueId: submission.leagueId,
      roundId: submission.roundId,
      comment: submission.comment ?? null,
      submittedBy: currentUser?.name ?? "You",
      roundTitle: round.title,
      leagueName,
      roundStatus,
      lyrics: submission.lyrics ?? null,
    });
  };

  return (
    <div className="space-y-4">
      {pendingProcessingCount > 0 ? (
        <Alert>
          <AlertTitle>
            {pendingProcessingCount} uploaded submission
            {pendingProcessingCount === 1 ? "" : "s"} still processing
          </AlertTitle>
          <AlertDescription>
            Your files are already uploaded safely. We will keep getting them
            ready in the background, so you do not need to keep this page open.
          </AlertDescription>
        </Alert>
      ) : null}

      {resolvedSubmissions.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          {hasMultipleTracks ? (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/40 md:px-4"
              aria-expanded={isExpanded}
              onClick={() => setIsMultiExpanded((current) => !current)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex shrink-0 -space-x-2">
                  {resolvedSubmissions.slice(0, 3).map((submission, index) => (
                    <div
                      key={submission._id}
                      className="overflow-hidden rounded-md border-2 border-background bg-muted"
                      style={{ zIndex: resolvedSubmissions.length - index }}
                    >
                      <MediaImage
                        src={submission.albumArtUrl ?? FALLBACK_ALBUM_ART}
                        alt={submission.songTitle}
                        width={36}
                        height={36}
                        className="size-9 object-cover"
                        fallbackSrc={FALLBACK_ALBUM_ART}
                      />
                    </div>
                  ))}
                </div>

                <p className="min-w-0 text-sm font-medium md:text-base">
                  {submittedTitlesSummary}
                </p>
              </div>

              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isExpanded && "rotate-180",
                )}
              />
            </button>
          ) : null}

          {(!hasMultipleTracks || isExpanded) && (
            <>
              <div className="hidden border-b border-border bg-muted/20 text-xs font-semibold uppercase text-muted-foreground md:block">
                <div className="grid grid-cols-[auto_4fr_2fr_auto] items-center gap-4 px-4 py-2">
                  <span className="w-10 text-center">#</span>
                  <span>Your Submitted Track(s)</span>
                  <span>Status</span>
                </div>
              </div>

              <div>
                {resolvedSubmissions.map((submission, index) => (
                  <MySubmissionRow
                    key={submission._id}
                    index={index}
                    roundStatus={roundStatus}
                    submission={submission}
                    onEdit={setEditingSubmission}
                    onListen={handleListen}
                    playable={canPlay(submission)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {canSubmitMore && canEditSubmissions ? (
        round.submissionMode === "album" ? (
          <AlbumSubmissionForm
            round={round}
            willAutoStartVotingOnLinkSubmit={willAutoStartVotingOnLinkSubmit}
          />
        ) : round.submissionMode === "multi" ? (
          <MultiSongSubmissionForm
            round={round}
            maxSongs={submissionsPerUser}
            currentCount={submissionCount}
            willAutoStartVotingOnLinkSubmit={willAutoStartVotingOnLinkSubmit}
          />
        ) : (
          <SongSubmissionForm
            round={round}
            willAutoStartVotingOnLinkSubmit={willAutoStartVotingOnLinkSubmit}
          />
        )
      ) : null}

      <Dialog
        open={!!editingSubmission}
        onOpenChange={(isOpen) => !isOpen && setEditingSubmission(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Your Submission</DialogTitle>
          </DialogHeader>
          {editingSubmission ? (
            <EditSubmissionForm
              submission={editingSubmission}
              onSubmitted={() => setEditingSubmission(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
