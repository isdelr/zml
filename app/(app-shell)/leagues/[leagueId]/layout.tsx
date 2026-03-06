import { LeaguePage } from "@/components/LeaguePage";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  return (
    <>
      <LeaguePage leagueId={leagueId} />
      {children}
    </>
  );
}
