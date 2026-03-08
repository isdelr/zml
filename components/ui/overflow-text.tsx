"use client";

import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from "react";
import { useEffect, useRef, useState } from "react";

type OverflowTextProps<T extends ElementType = "p"> = {
  as?: T;
  marquee?: boolean;
  textClassName?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children"> & {
  children: string;
};

export function OverflowText<T extends ElementType = "p">({
  as,
  marquee = false,
  className,
  textClassName,
  children,
  title,
  ...props
}: OverflowTextProps<T>) {
  const Tag = (as ?? "p") as ElementType;
  const containerRef = useRef<HTMLElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);

  useEffect(() => {
    if (!marquee) return;

    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const measure = () => {
      const nextOverflow = Math.max(
        0,
        Math.ceil(text.scrollWidth - container.clientWidth),
      );
      setOverflowDistance((current) =>
        current === nextOverflow ? current : nextOverflow,
      );
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    resizeObserver.observe(text);

    return () => resizeObserver.disconnect();
  }, [children, marquee]);

  if (!marquee) {
    return (
      <Tag
        className={cn(
          "min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]",
          className,
        )}
        title={title ?? children}
        {...props}
      >
        {children}
      </Tag>
    );
  }

  const isOverflowing = overflowDistance > 0;
  const marqueeStyle = isOverflowing
    ? ({
        "--overflow-marquee-distance": `-${overflowDistance}px`,
        "--overflow-marquee-duration": `${Math.max(6, overflowDistance / 18)}s`,
      } as CSSProperties)
    : undefined;

  return (
    <Tag
      ref={containerRef as never}
      className={cn("min-w-0 overflow-hidden whitespace-nowrap", className)}
      title={title ?? children}
      {...props}
    >
      <span
        ref={textRef}
        className={cn(
          isOverflowing
            ? "inline-block min-w-max animate-overflow-marquee will-change-transform"
            : "block truncate",
          textClassName,
        )}
        style={marqueeStyle}
      >
        {children}
      </span>
    </Tag>
  );
}
