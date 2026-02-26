"use client";

import type { FunctionReturnType } from "convex/server";

import { api } from "@/lib/convex/api";
import type { LeagueData } from "@/lib/convex/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettingsTab } from "@/components/league/settings/GeneralSettingsTab";
import { MembersTab } from "@/components/league/settings/MembersTab";
import { InviteTab } from "@/components/league/settings/InviteTab";

type CurrentUser = FunctionReturnType<typeof api.users.getCurrentUser> | undefined;

interface LeagueSettingsDialogProps {
  league: LeagueData;
  currentUser: CurrentUser;
  onClose: () => void;
}

export function LeagueSettingsDialog({
  league,
  currentUser,
  onClose,
}: LeagueSettingsDialogProps) {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="invite">Invite Link</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Update your league&apos;s name, description, and rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsTab league={league} onClose={onClose} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="members">
        <Card>
          <CardHeader>
            <CardTitle>Manage Members</CardTitle>
            <CardDescription>
              View and remove members from your league.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembersTab league={league} currentUser={currentUser} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="invite">
        <Card>
          <CardHeader>
            <CardTitle>Invite Link</CardTitle>
            <CardDescription>
              Manage how people can join your league.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteTab league={league} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
