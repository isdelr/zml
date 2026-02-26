"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AlbumTracksSectionHeaderProps {
  onAddTrack: () => void;
}

export function AlbumTracksSectionHeader({
  onAddTrack,
}: AlbumTracksSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">Tracks</h3>
      <Button type="button" variant="outline" size="sm" onClick={onAddTrack}>
        <Plus className="mr-2 size-4" />
        Add Track
      </Button>
    </div>
  );
}
