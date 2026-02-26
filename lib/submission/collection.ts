export function createSubmissionCollectionId(roundId: string): string {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);

  return `${roundId}_${Date.now()}_${randomPart}`;
}

