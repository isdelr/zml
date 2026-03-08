"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toSvg } from "jdenticon";

interface AvatarStackProps {
  users: {
    _id?: string;
    name?: string | null;
    image?: string | null;
  }[];
  max?: number;
  className?: string;
  avatarClassName?: string;
  overflowClassName?: string;
}

export function AvatarStack({
  users,
  max = 10,
  className,
  avatarClassName,
  overflowClassName,
}: AvatarStackProps) {
  const visibleUsers = users.slice(0, max);
  const hiddenCount = users.length - visibleUsers.length;

  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {visibleUsers.map((user, index) => (
        <Avatar
          key={index}
          className={cn("size-8 border-2 border-background", avatarClassName)}
        >
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
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-muted-foreground",
            overflowClassName,
          )}
        >
          {hiddenCount}
        </div>
      )}
    </div>
  );
}
