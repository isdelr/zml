import { Music } from "lucide-react";
const loadingMessages = [
  "Finding the right key...",
  "Tuning the strings...",
  "Syncing the tempo...",
  "Polishing the high notes...",
  "Cueing up the first track...",
];

export function LoadingSpinner() {
  const message = loadingMessages[0];

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background text-foreground">
      <div className="relative flex items-center justify-center">
        {/* We use the Music icon and a pulse animation that fits the theme */}
        <Music className="size-16 animate-pulse text-primary [animation-duration:1.5s]" />
      </div>
      <p className="text-lg font-medium text-muted-foreground">{message}</p>
    </div>
  );
}
