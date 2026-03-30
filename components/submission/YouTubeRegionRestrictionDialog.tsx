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

export type YouTubeRegionRestrictionDialogItem = {
  label?: string;
  songTitle: string;
  artist: string;
  blockedRegions: Array<{
    code: string;
    name: string;
  }>;
};

interface YouTubeRegionRestrictionDialogProps {
  open: boolean;
  items: YouTubeRegionRestrictionDialogItem[];
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

function formatBlockedRegionCount(count: number) {
  return `${count} countr${count === 1 ? "y" : "ies"}`;
}

export function YouTubeRegionRestrictionDialog({
  open,
  items,
  onOpenChange,
  onCancel,
  onConfirm,
  confirmLabel = "Submit Anyway",
}: YouTubeRegionRestrictionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>YouTube Region Restriction</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                One or more YouTube submissions are blocked in specific
                countries. People in those regions may not be able to play these
                songs.
              </p>

              <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2">
                {items.map((item, index) => (
                  <section
                    key={`${item.songTitle}-${item.artist}-${index}`}
                    className="rounded-md border bg-muted/30 p-3"
                  >
                    <p className="font-medium text-foreground">
                      {item.label ? `${item.label}: ` : null}
                      {item.songTitle} by {item.artist}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                      Blocked in{" "}
                      {formatBlockedRegionCount(item.blockedRegions.length)}
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {item.blockedRegions
                        .map((region) => region.name)
                        .join(", ")}
                    </p>
                  </section>
                ))}
              </div>

              <p>Do you want to continue anyway?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
