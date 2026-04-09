"use client";

import React, { MouseEvent, useEffect, useRef, useState } from "react";
import WaveformData from "waveform-data";
import { toSvg } from "jdenticon";
import { Id } from "@/convex/_generated/dataModel";
import {
  getCachedWaveformBars,
  getWaveformAmplitudeScale,
} from "@/lib/music/waveform-render";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const BAR_WIDTH = 2;
const BAR_GAP = 1;
const TOTAL_BAR_WIDTH = BAR_WIDTH + BAR_GAP;

export interface WaveformComment {
  id: Id<"comments">;
  time: number;
  text: string;
  authorName: string;
  authorImage: string | null;
  avatarSeed: string;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCommentId, setHoveredCommentId] = useState<Id<"comments"> | null>(
    null,
  );
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const nextSize = {
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      };

      setCanvasSize((currentSize) =>
        currentSize.width === nextSize.width &&
        currentSize.height === nextSize.height
          ? currentSize
          : nextSize,
      );
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvasSize.width || canvas.clientWidth;
    const height = canvasSize.height || canvas.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const middleY = height / 2;
    const requestedBarCount = Math.max(1, Math.floor(width / TOTAL_BAR_WIDTH));
    const displayBars = getCachedWaveformBars(waveform, requestedBarCount);

    if (displayBars.barCount === 0) {
      return;
    }

    const progressBarCount =
      duration > 0
        ? Math.min(
            displayBars.barCount,
            Math.max(
              0,
              Math.floor((Math.max(0, progress) / duration) * displayBars.barCount),
            ),
          )
        : 0;
    const savedProgressBarCount =
      duration > 0 && typeof savedProgress === "number" && Number.isFinite(savedProgress)
        ? Math.min(
            displayBars.barCount,
            Math.max(
              0,
              Math.floor(
                (Math.max(0, savedProgress) / duration) * displayBars.barCount,
              ),
            ),
          )
        : 0;

    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim();
    const mutedColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--muted-foreground")
      .trim();
    const { positiveMax, negativeMax } = getWaveformAmplitudeScale(
      displayBars.bits,
    );

    ctx.lineWidth = BAR_WIDTH;
    ctx.lineCap = "round";

    const drawBars = (limit: number, color: string) => {
      ctx.strokeStyle = color;

      for (let index = 0; index < limit; index += 1) {
        const bar = displayBars.bars[index];
        if (!bar) {
          continue;
        }

        const x = BAR_GAP + index * TOTAL_BAR_WIDTH + BAR_WIDTH / 2;
        const topHalfHeight =
          (Math.max(0, bar.maxSample) / positiveMax) * middleY;
        const bottomHalfHeight =
          (Math.abs(Math.min(0, bar.minSample)) / negativeMax) * middleY;
        const barTopY = middleY - topHalfHeight;
        const barBottomY = middleY + bottomHalfHeight;

        ctx.beginPath();
        ctx.moveTo(x, barTopY);
        ctx.lineTo(x, barBottomY);
        ctx.stroke();
      }
    };

    drawBars(displayBars.barCount, mutedColor);

    if (savedProgressBarCount > 0) {
      ctx.globalAlpha = 0.3;
      drawBars(savedProgressBarCount, primaryColor);
      ctx.globalAlpha = 1;
    }

    if (progressBarCount > 0) {
      drawBars(progressBarCount, primaryColor);
    }
  }, [canvasSize.height, canvasSize.width, duration, progress, savedProgress, waveform]);

  const handleSeek = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.currentTarget as HTMLElement;
    if (!duration) return;

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;

    const clickX = event.clientX - rect.left;
    const seekFraction = Math.min(1, Math.max(0, clickX / rect.width));
    const seekTime = duration * seekFraction;
    onSeek(seekTime);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (hoveredCommentId) return;
    setIsDragging(true);
    handleSeek(event);
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleSeek(event);
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
      ref={containerRef}
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
                onClick={(event) => {
                  event.stopPropagation();
                  onSeek(comment.time);
                }}
              >
                <Avatar className="size-5 cursor-pointer border-2 border-background transition-transform hover:scale-125">
                  <AvatarImage src={comment.authorImage ?? undefined} />
                  <AvatarFallback>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: toSvg(comment.avatarSeed, 20),
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
                          __html: toSvg(comment.avatarSeed, 24),
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
