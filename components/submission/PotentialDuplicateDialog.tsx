"use client";

import type { DuplicateSubmissionWarning } from "@/lib/convex/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PotentialDuplicateDialogProps {
  open: boolean;
  data: DuplicateSubmissionWarning | null;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function PotentialDuplicateDialog({
  open,
  data,
  onOpenChange,
  onCancel,
  onConfirm,
}: PotentialDuplicateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Potential Duplicate Submission</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {data?.songExists ? (
              <p>
                A song with a similar title,{" "}
                <strong>&quot;{data.songExists.title}&quot;</strong> by{" "}
                <strong>{data.songExists.artist}</strong>, was already submitted
                in the &quot;{data.songExists.roundTitle}&quot; round.
              </p>
            ) : null}
            {data?.artistExists ? (
              <p>
                An artist named <strong>{data.artistExists.artist}</strong> has
                already been submitted in this league (song:{" "}
                <strong>&quot;{data.artistExists.title}&quot;</strong>).
              </p>
            ) : null}
            <p className="pt-2">Are you sure you want to submit this song?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Submit Anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
