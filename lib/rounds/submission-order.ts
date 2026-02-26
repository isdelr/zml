type SubmissionLike = {
  _id: string;
  submissionType: string;
  points: number;
};

function createSeedFromString(str: string): number {
  let seed = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    seed = (seed << 5) - seed + charCode;
    seed |= 0;
  }
  return seed;
}

function createSeededRandom(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const current = shuffled[i];
    const target = shuffled[j];
    if (current === undefined || target === undefined) continue;
    shuffled[i] = target;
    shuffled[j] = current;
  }
  return shuffled;
}

export function getSortedRoundSubmissions<T extends SubmissionLike>(
  submissions: T[],
  roundStatus: string,
  roundId: string,
): T[] {
  if (roundStatus === "finished") {
    return [...submissions].sort((a, b) => b.points - a.points);
  }

  const sortById = (a: T, b: T) => a._id.localeCompare(b._id);
  const fileSubmissions = submissions
    .filter((s) => s.submissionType === "file")
    .sort(sortById);
  const linkSubmissions = submissions
    .filter((s) => s.submissionType === "youtube")
    .sort(sortById);

  const random = createSeededRandom(createSeedFromString(roundId));
  const shuffledFiles = shuffleArray(fileSubmissions, random);
  const shuffledLinks = shuffleArray(linkSubmissions, random);

  return [...shuffledFiles, ...shuffledLinks];
}
