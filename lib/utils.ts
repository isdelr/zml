import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { intervalToDuration } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDeadline(deadline: number): string {
  const now = Date.now();
  if (now > deadline) {
    return "Ended";
  }
  const duration = intervalToDuration({ start: now, end: deadline });
  const parts: string[] = [];
  if (duration.days && duration.days > 0) parts.push(`${duration.days}d`);
  if (duration.hours && duration.hours > 0) parts.push(`${duration.hours}h`);
  if (duration.days === 0 && duration.minutes && duration.minutes > 0) parts.push(`${duration.minutes}m`);
  if (parts.length === 0) {
    return "ending soon";
  }
  return `in ${parts.join(" ")}`;
}
