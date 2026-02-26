"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MultiTracksSectionHeaderProps {
  trackCount: number;
  remainingSongs: number;
  onAddTrack: () => void;
  disabled?: boolean;
}

export function MultiTracksSectionHeader({
  trackCount,
  remainingSongs,
  onAddTrack,
  disabled,
}: MultiTracksSectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-lg font-semibold">
        Songs ({trackCount}/{remainingSongs})
      </h3>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAddTrack}
        disabled={disabled}
      >
        <Plus className="mr-2 size-4" />
        Add Song
      </Button>
    </div>
  );
}
