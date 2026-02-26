"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSvg } from "jdenticon";

interface AvatarStackProps {
  users: {
    _id?: string;
    name?: string | null;
    image?: string | null;
  }[];
  max?: number;
}

export function AvatarStack({ users, max = 10 }: AvatarStackProps) {
  const visibleUsers = users.slice(0, max);
  const hiddenCount = users.length - visibleUsers.length;

  return (
    <div className="flex items-center -space-x-2">
      {visibleUsers.map((user, index) => (
        <Avatar key={index} className="size-8 border-2 border-background">
          <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
          <AvatarFallback>
            <div
              className="size-full"
              dangerouslySetInnerHTML={{
                __html: toSvg(user.name ?? user._id ?? "anon", 100),
              }}
            />
          </AvatarFallback>
        </Avatar>
      ))}
      {hiddenCount > 0 && (
        <div className="flex size-6 items-center justify-center rounded-full bg-muted border-2 border-background text-xs font-semibold text-muted-foreground">
          {hiddenCount}
        </div>
      )}
    </div>
  );
}
