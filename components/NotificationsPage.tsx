"use client";

import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, MessageSquare, PlayCircle, Vote, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const notificationIcons = {
  new_comment: <MessageSquare className="size-5 text-info" />,
  round_submission: <PlayCircle className="size-5 text-success" />,
  round_voting: <Vote className="size-5 text-highlight" />,
  round_finished: <Trophy className="size-5 text-warning" />,
};

export default function NotificationsPage() {
  const {
    results: notifications,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.notifications.getForUser,
    {},
    { initialNumItems: 10 },
  );
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const handleMarkAsRead = (notificationId: Id<"notifications">) => {
    markAsRead({ notificationId });
  };

  const handleMarkAllAsRead = () => {
    toast.promise(markAllAsRead(), {
      loading: "Marking all as read...",
      success: "All notifications marked as read.",
      error: "Failed to mark all as read.",
    });
  };

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="min-h-full bg-background p-4 text-foreground md:p-8">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-2xl">Notifications</CardTitle>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {status !== "LoadingFirstPage" &&
            notifications &&
            notifications.length === 0 && (
              <div className="py-20 text-center">
                <Bell className="mx-auto size-12 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold">
                  No notifications yet
                </h3>
                <p className="mt-2 text-muted-foreground">
                  We&apos;ll let you know when there&apos;s something new.
                </p>
              </div>
            )}
          {notifications && notifications.length > 0 && (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <Link
                  href={notification.link}
                  key={notification._id}
                  onClick={() => handleMarkAsRead(notification._id)}
                >
                  <div
                    className={cn(
                      "group flex items-start gap-4 rounded-lg p-4 transition-colors hover:bg-accent",
                      !notification.read && "bg-accent/50",
                    )}
                  >
                    <div className="mt-1 flex-shrink-0">
                      {notification.triggeringUserImage ? (
                        <Avatar className="size-10">
                          <AvatarImage
                            src={notification.triggeringUserImage}
                            alt={notification.triggeringUserName ?? "User"}
                          />
                          <AvatarFallback>?</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
                          {notificationIcons[notification.type]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          "text-sm",
                          !notification.read && "font-semibold",
                        )}
                      >
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(notification._creationTime, {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="mt-1 size-2.5 flex-shrink-0 rounded-full bg-primary transition-transform group-hover:scale-125" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {status === "CanLoadMore" && (
            <div className="mt-4 flex justify-center">
              <Button onClick={() => loadMore(10)} variant="outline">
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
