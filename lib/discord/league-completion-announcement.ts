type FinisherSummary = {
  name: string;
  totalPoints: number;
  totalWins: number;
};

export function buildLeagueCompletionAnnouncement(args: {
  leagueName: string;
  champion: FinisherSummary;
  championSubmissionCount: number;
  championWonOnTieBreak: boolean;
  championTieBreakSummary: string | null;
  runnersUp: FinisherSummary[];
}) {
  const championLine = `**${args.champion.name}** wins **${args.leagueName}** with **${args.champion.totalPoints} pts**.`;
  const summaryLines = [
    `Round wins: **${args.champion.totalWins}**`,
    `Submissions: **${args.championSubmissionCount}**`,
  ];
  if (args.championWonOnTieBreak && args.championTieBreakSummary) {
    summaryLines.push(`Tie-break: ${args.championTieBreakSummary}`);
  }

  const podiumLines = args.runnersUp.map((finisher, index) => {
    const placement = index === 0 ? "2nd" : "3rd";
    const winsSuffix =
      finisher.totalWins === 1 ? "1 round win" : `${finisher.totalWins} round wins`;
    return `${placement}: **${finisher.name}** with **${finisher.totalPoints} pts** (${winsSuffix})`;
  });

  const descriptionLines = [championLine, "", ...summaryLines];
  if (podiumLines.length > 0) {
    descriptionLines.push("", "**Podium**", ...podiumLines);
  }

  return descriptionLines.join("\n");
}
