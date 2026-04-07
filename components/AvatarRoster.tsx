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
  variant?: "default" | "ghost";
}

export function AvatarRoster({
  users,
  className,
  avatarClassName,
  variant = "default",
}: AvatarRosterProps) {
  if (users.length === 0) {
    return null;
  }

  const containerClassName =
    variant === "ghost"
      ? "rounded-2xl border border-border/35 bg-background/35 p-2.5 backdrop-blur-sm"
      : undefined;
  const avatarBaseClassName =
    variant === "ghost"
      ? "size-7 shrink-0 border border-border/40 bg-background/55"
      : "size-7 shrink-0 border border-border/70 bg-background";
  const adminAdjustmentClassName =
    variant === "ghost"
      ? "flex size-7 shrink-0 items-center justify-center rounded-full border border-border/40 bg-background/45 text-primary/80 backdrop-blur-sm dark:text-primary"
      : "flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-primary/80 dark:text-primary";

  return (
    <div
      className={cn(
        "flex max-w-full flex-wrap gap-1.5",
        containerClassName,
        className,
      )}
    >
      {users.map((user, index) =>
        user.isAdminAdjustment ? (
          <div
            key={`${user._id ?? user.name ?? "admin"}-${index}`}
            className={cn(
              adminAdjustmentClassName,
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
              avatarBaseClassName,
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
