"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toSvg } from "jdenticon";
import { Shield } from "lucide-react";

type AvatarRosterUser = {
  _id?: string;
  name?: string | null;
  image?: string | null;
  isAdminAdjustment?: boolean;
};

interface AvatarRosterProps {
  users: AvatarRosterUser[];
  className?: string;
  avatarClassName?: string;
}

export function AvatarRoster({
  users,
  className,
  avatarClassName,
}: AvatarRosterProps) {
  if (users.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex max-w-full flex-wrap gap-1.5", className)}>
      {users.map((user, index) =>
        user.isAdminAdjustment ? (
          <div
            key={`${user._id ?? user.name ?? "admin"}-${index}`}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-primary/80 dark:text-primary",
              avatarClassName,
            )}
            aria-label={user.name ?? "Admin adjustment"}
            title={user.name ?? "Admin adjustment"}
          >
            <Shield className="size-[65%] fill-current stroke-current" />
          </div>
        ) : (
          <Avatar
            key={`${user._id ?? user.name ?? "user"}-${index}`}
            className={cn(
              "size-7 shrink-0 border border-border/70 bg-background",
              avatarClassName,
            )}
            title={user.name ?? "Unknown user"}
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
    </div>
  );
}
