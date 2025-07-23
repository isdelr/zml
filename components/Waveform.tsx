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

    const channel = waveform.channel(0);
    const middleY = height / 2;

    const barWidth = 2;
    const barGap = 1;
    const totalBarWidth = barWidth + barGap;
    const numBars = Math.floor(width / totalBarWidth);

    const progressInBars = duration > 0 ? (progress / duration) * numBars : 0;

    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim();
    const mutedColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--muted-foreground")
      .trim();

    ctx.lineWidth = barWidth;
    ctx.lineCap = "round";

    for (let i = 0; i < numBars; i++) {
      const x = barGap + i * totalBarWidth + barWidth / 2;

      const sampleIndex = Math.floor((i / numBars) * waveform.length);
      const maxSample = channel.max_sample(sampleIndex);
      const minSample = channel.min_sample(sampleIndex);

      const topHalfHeight = (maxSample / 127) * middleY;
      const bottomHalfHeight = (Math.abs(minSample) / 128) * middleY;

      const barTopY = middleY - topHalfHeight;
      const barBottomY = middleY + bottomHalfHeight;

      ctx.strokeStyle = i < progressInBars ? primaryColor : mutedColor;

      ctx.beginPath();
      ctx.moveTo(x, barTopY);
      ctx.lineTo(x, barBottomY);
      ctx.stroke();
    }
  }, [waveform, progress, duration]);

  const handleSeek = (e: MouseEvent<HTMLCanvasElement | HTMLDivElement>) => {
    const target = e.currentTarget as HTMLElement;
    if (!duration) return;

    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekFraction = clickX / rect.width;
    const seekTime = duration * seekFraction;
    onSeek(seekTime);
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (hoveredCommentId) return;
    setIsDragging(true);
    handleSeek(e);
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
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
  }

  const handleCommentMouseLeave = () => {
    setHoveredCommentId(null);
  }

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
          <Popover key={comment.id} open={hoveredCommentId === comment.id} >
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