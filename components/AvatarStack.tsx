"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toSvg } from "jdenticon";
import { Shield } from "lucide-react";

interface AvatarStackProps {
  users: {
    _id?: string;
    name?: string | null;
    image?: string | null;
    isAdminAdjustment?: boolean;
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
      {visibleUsers.map((user, index) =>
        user.isAdminAdjustment ? (
          <div
            key={index}
            className={cn(
              avatarClassName,
              "relative z-10 flex size-8 items-center justify-center text-amber-600",
              "!border-0 !rounded-none !bg-transparent shadow-none",
            )}
            aria-label={user.name ?? "Admin adjustment"}
            title={user.name ?? "Admin adjustment"}
          >
            <Shield className="size-[70%] fill-current stroke-current" />
          </div>
        ) : (
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
        ),
      )}
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
