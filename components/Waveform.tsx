// File: components/Waveform.tsx

"use client";

import React, { useRef, useEffect, MouseEvent, useState } from "react";
import WaveformData from "waveform-data";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toSvg } from "jdenticon";

export interface WaveformComment {
  id: Id<"comments">;
  time: number;
  text: string;
  authorName: string;
  authorImage: string | null;
  authorId: string;
}

interface WaveformProps {
  waveform: WaveformData;
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
  comments: WaveformComment[];
  savedProgress?: number;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export function Waveform({
                           waveform,
                           progress,
                           duration,
                           onSeek,
                           className,
                           comments,
                           savedProgress,
                         }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCommentId, setHoveredCommentId] = useState<Id<"comments"> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);

    // Safety guards against edge cases that could cause out-of-bounds reads
    const channel = waveform.channel(0);
    const channelLength = Math.max(0, waveform.length || 0);
    if (channelLength === 0) {
      // Nothing to draw
      return;
    }

    const middleY = height / 2;

    const barWidth = 2;
    const barGap = 1;
    const totalBarWidth = barWidth + barGap;
    const numBars = Math.max(1, Math.floor(width / totalBarWidth)); // ensure at least 1 bar

    const progressInBars = duration > 0 ? (progress / duration) * numBars : 0;
    const savedProgressInBars =
      duration > 0 && savedProgress ? (savedProgress / duration) * numBars : 0;

    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim();
    const mutedColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--muted-foreground")
      .trim();

    ctx.lineWidth = barWidth;
    ctx.lineCap = "round";

    // Map a bar index [0..numBars-1] to a valid sample index [0..channelLength-1]
    // This mapping guarantees we never exceed the data bounds.
    const sampleIndexForBar = (barIndex: number) => {
      if (numBars === 1) return 0; // single bar -> first sample
      const rawIndex =
        (barIndex * (channelLength - 1)) / (numBars - 1); // exact mapping
      const idx = Math.floor(rawIndex);
      // Clamp defensively to avoid any out-of-bounds access in waveform-data
      return Math.min(Math.max(idx, 0), channelLength - 1);
    };

    const drawBars = (limit: number, color: string) => {
      ctx.strokeStyle = color;
      for (let i = 0; i < limit; i++) {
        const x = barGap + i * totalBarWidth + barWidth / 2;

        const sampleIndex = sampleIndexForBar(i);

        // Guard against any unexpected library behavior with try/catch,
        // but this should not be hit thanks to the clamping above.
        let maxSample = 0;
        let minSample = 0;
        try {
          maxSample = channel.max_sample(sampleIndex);
          minSample = channel.min_sample(sampleIndex);
        } catch {
          // If something went wrong, skip this bar instead of crashing
          continue;
        }

        const topHalfHeight = (maxSample / 127) * middleY;
        const bottomHalfHeight = (Math.abs(minSample) / 128) * middleY;

        const barTopY = middleY - topHalfHeight;
        const barBottomY = middleY + bottomHalfHeight;

        ctx.beginPath();
        ctx.moveTo(x, barTopY);
        ctx.lineTo(x, barBottomY);
        ctx.stroke();
      }
    };

    // 1. Draw all bars in muted color
    drawBars(numBars, mutedColor);

    // 2. Draw saved progress with transparent primary
    if (savedProgressInBars > 0) {
      ctx.globalAlpha = 0.3;
      drawBars(Math.min(numBars, Math.floor(savedProgressInBars)), primaryColor);
      ctx.globalAlpha = 1.0;
    }

    // 3. Draw played progress with solid primary
    drawBars(Math.min(numBars, Math.floor(progressInBars)), primaryColor);
  }, [waveform, progress, duration, savedProgress]);

  const handleSeek = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLElement;
    if (!duration) return;

    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekFraction = clickX / rect.width;
    const seekTime = duration * seekFraction;
    onSeek(seekTime);
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (hoveredCommentId) return;
    setIsDragging(true);
    handleSeek(e);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleSeek(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleCommentMouseEnter = (commentId: Id<"comments">) => {
    setHoveredCommentId(commentId);
  };

  const handleCommentMouseLeave = () => {
    setHoveredCommentId(null);
  };

  return (
    <div
      className={cn("relative w-full cursor-pointer", className)}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute inset-0">
        {comments.map((comment) => (
          <Popover key={comment.id} open={hoveredCommentId === comment.id}>
            <PopoverTrigger
              onMouseEnter={() => handleCommentMouseEnter(comment.id)}
              onMouseLeave={handleCommentMouseLeave}
              asChild
            >
              <div
                className="absolute -top-1/2 z-10"
                style={{
                  left: `${duration > 0 ? (comment.time / duration) * 100 : 0}%`,
                  transform: "translateX(-50%)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(comment.time);
                }}
              >
                <Avatar className="size-5 cursor-pointer border-2 border-background transition-transform hover:scale-125">
                  <AvatarImage src={comment.authorImage ?? undefined} />
                  <AvatarFallback>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: toSvg(comment.authorId, 20),
                      }}
                    />
                  </AvatarFallback>
                </Avatar>
              </div>
            </PopoverTrigger>
            <PopoverContent
              onMouseEnter={() => handleCommentMouseEnter(comment.id)}
              onMouseLeave={handleCommentMouseLeave}
              className="w-auto max-w-xs"
              side="top"
              align="center"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarImage src={comment.authorImage ?? undefined} />
                    <AvatarFallback>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: toSvg(comment.authorId, 24),
                        }}
                      />
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-semibold">{comment.authorName}</p>
                </div>
                <blockquote className="border-l-2 pl-3 text-sm italic break-words">
                  {comment.text}
                </blockquote>
                <p className="text-right text-xs text-muted-foreground">
                  at {formatTime(comment.time)}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}
