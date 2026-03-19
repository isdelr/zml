const COMMENT_NAME_PREFIXES = [
  "Amber",
  "Arctic",
  "Bold",
  "Bright",
  "Calm",
  "Cinder",
  "Clear",
  "Cobalt",
  "Copper",
  "Crimson",
  "Daring",
  "Drift",
  "Echo",
  "Ember",
  "Fable",
  "Golden",
  "Harbor",
  "Hidden",
  "Indigo",
  "Juniper",
  "Kind",
  "Lunar",
  "Maple",
  "Mellow",
  "Misty",
  "North",
  "Quiet",
  "River",
  "Silver",
  "Solar",
  "Velvet",
  "Willow",
] as const;

const COMMENT_NAME_SUFFIXES = [
  "Badger",
  "Comet",
  "Falcon",
  "Finch",
  "Fox",
  "Harbor",
  "Heron",
  "Lark",
  "Lion",
  "Lotus",
  "Meadow",
  "Meteor",
  "Otter",
  "Owl",
  "Panda",
  "Pine",
  "Quartz",
  "Raven",
  "Robin",
  "Sparrow",
  "Spruce",
  "Starling",
  "Stone",
  "Swift",
  "Thistle",
  "Tiger",
  "Violet",
  "Wave",
  "Wolf",
  "Wren",
] as const;

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getAnonymousCommentIdentity(
  roundId: string,
  userId: string,
): {
  avatarSeed: string;
  displayName: string;
} {
  const seed = `comment:${roundId}:${userId}`;
  const hash = hashString(seed);
  const prefix = COMMENT_NAME_PREFIXES[hash % COMMENT_NAME_PREFIXES.length];
  const suffix =
    COMMENT_NAME_SUFFIXES[
      (((hash >>> 8) ^ hash) >>> 0) % COMMENT_NAME_SUFFIXES.length
    ];
  const badge = ((hash >>> 16) % 900) + 100;

  return {
    avatarSeed: `anonymous-comment:${seed}`,
    displayName: `${prefix} ${suffix} ${badge}`,
  };
}
