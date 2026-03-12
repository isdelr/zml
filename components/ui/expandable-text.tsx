"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

const lineClampClassNames = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
} as const;

type ExpandableTextProps = {
  children: string;
  collapsedLines?: keyof typeof lineClampClassNames;
  className?: string;
  textClassName?: string;
  buttonClassName?: string;
};

export function ExpandableText({
  children,
  collapsedLines = 3,
  className,
  textClassName,
  buttonClassName,
}: ExpandableTextProps) {
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLParagraphElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpandable, setIsExpandable] = useState(false);

  const clampClass = lineClampClassNames[collapsedLines];

  useEffect(() => {
    const measureOverflow = () => {
      const probe = probeRef.current;
      if (!probe) return;

      const hasOverflow = probe.scrollHeight - probe.clientHeight > 1;
      setIsExpandable((current) =>
        current === hasOverflow ? current : hasOverflow,
      );

      if (!hasOverflow) {
        setIsExpanded(false);
      }
    };

    const frame = window.requestAnimationFrame(measureOverflow);
    const cleanup = () => window.cancelAnimationFrame(frame);

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureOverflow);
      return () => {
        cleanup();
        window.removeEventListener("resize", measureOverflow);
      };
    }

    const resizeObserver = new ResizeObserver(measureOverflow);
    if (rootRef.current) resizeObserver.observe(rootRef.current);
    if (probeRef.current) resizeObserver.observe(probeRef.current);

    return () => {
      cleanup();
      resizeObserver.disconnect();
    };
  }, [children, collapsedLines]);

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <p
        aria-hidden="true"
        data-slot="expandable-text-probe"
        ref={probeRef}
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden opacity-0",
          "whitespace-normal break-words [overflow-wrap:anywhere]",
          clampClass,
          textClassName,
        )}
      >
        {children}
      </p>
      <p
        id={contentId}
        data-slot="expandable-text-content"
        className={cn(
          "whitespace-normal break-words [overflow-wrap:anywhere]",
          !isExpanded && clampClass,
          textClassName,
        )}
      >
        {children}
      </p>
      {isExpandable ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "mt-1.5 h-8 rounded-full px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/10 hover:text-primary md:h-7",
            buttonClassName,
          )}
          aria-controls={contentId}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? "View less" : "View more"}
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </Button>
      ) : null}
    </div>
  );
}
