const COMMENT_HANDLE_WORDS = [
  "Aster",
  "Atlas",
  "Beacon",
  "Birch",
  "Blaze",
  "Bloom",
  "Bramble",
  "Breeze",
  "Brook",
  "Cedar",
  "Cinder",
  "Clover",
  "Comet",
  "Coral",
  "Cosmos",
  "Cove",
  "Cricket",
  "Crown",
  "Dawn",
  "Delta",
  "Drift",
  "Echo",
  "Ember",
  "Everest",
  "Fern",
  "Fjord",
  "Flare",
  "Flint",
  "Frost",
  "Gale",
  "Garden",
  "Glade",
  "Glow",
  "Grove",
  "Harbor",
  "Haven",
  "Indigo",
  "Iris",
  "Jasper",
  "Juniper",
  "Kestrel",
  "Lagoon",
  "Laurel",
  "Lemon",
  "Lilac",
  "Linden",
  "Lotus",
  "Lumen",
  "Maple",
  "Meadow",
  "Mercury",
  "Mica",
  "Mist",
  "Monarch",
  "Nova",
  "Oak",
  "Olive",
  "Onyx",
  "Orchid",
  "Pebble",
  "Pine",
  "Prism",
  "Quartz",
  "Rain",
  "Raven",
  "Reef",
  "River",
  "Robin",
  "Saffron",
  "Sage",
  "Shadow",
  "Shore",
  "Sierra",
  "Silver",
  "Sky",
  "Solstice",
  "Sparrow",
  "Spruce",
  "Starling",
  "Stone",
  "Summit",
  "Sundial",
  "Sunset",
  "Thistle",
  "Thunder",
  "Timber",
  "Topaz",
  "Vale",
  "Velvet",
  "Verdant",
  "Violet",
  "Wave",
  "Willow",
  "Winter",
  "Wren",
  "Zephyr",
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
  const displayName = COMMENT_HANDLE_WORDS[hash % COMMENT_HANDLE_WORDS.length];

  return {
    avatarSeed: `anonymous-comment:${seed}`,
    displayName,
  };
}
