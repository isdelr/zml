import { LeagueExportReportPage } from "@/components/league/LeagueExportReportPage";

export default async function LeagueExportPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  return <LeagueExportReportPage leagueId={leagueId} />;
}
