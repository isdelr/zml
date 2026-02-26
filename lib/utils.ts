import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDeadline(deadline: number): string {
  if (Date.now() > deadline) {
    return "Ended";
  }
  return format(new Date(deadline), "MMM d, yyyy 'at' h:mm a");
}
