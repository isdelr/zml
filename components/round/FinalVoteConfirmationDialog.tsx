"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FinalVoteConfirmationDialogProps {
  open: boolean;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FinalVoteConfirmationDialog({
  open,
  confirmText,
  onConfirmTextChange,
  onCancel,
  onConfirm,
}: FinalVoteConfirmationDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent className="notranslate" translate="no">
        <AlertDialogHeader>
          <AlertDialogTitle>
            <span>Final Vote Confirmation</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span>
              This is your last vote for this round. Once you cast this vote,
              all your votes will be locked and cannot be changed. Are you sure
              you want to proceed?
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-input" className="text-sm font-medium">
            To confirm, please type &quot;confirm&quot; below.
          </Label>
          <Input
            id="confirm-input"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            <span>Cancel</span>
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={confirmText.toLowerCase() !== "confirm"}
          >
            <span>Confirm Final Vote</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
