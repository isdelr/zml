"use client";

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { Id } from "@/convex/_generated/dataModel";

 
const Standings = dynamicImport(() => import("@/components/Standings").then(mod => ({ default: mod.Standings })));
const LeagueStats = dynamicImport(() => import("@/components/LeagueStats").then(mod => ({ default: mod.LeagueStats })));

interface LeagueTabsProps {
  activeTab: string;
  isLeagueFinished: boolean;
  leagueId: Id<"leagues">;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export function LeagueTabs({
  activeTab,
  isLeagueFinished,
  leagueId,
  onTabChange,
  children,
}: LeagueTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      className="w-full"
    >
      <TabsList
        className={cn(
          "mb-8 grid w-full",
          isLeagueFinished ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        <TabsTrigger value="rounds">Rounds</TabsTrigger>
        <TabsTrigger value="standings">Standings</TabsTrigger>
        {isLeagueFinished && (
          <TabsTrigger value="awards">Awards</TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="rounds">
        {children}
      </TabsContent>
      <TabsContent value="standings">
        <Standings leagueId={leagueId} />
      </TabsContent>
      {isLeagueFinished && (
        <TabsContent value="awards">
          <LeagueStats leagueId={leagueId} />
        </TabsContent>
      )}
    </Tabs>
  );
}
