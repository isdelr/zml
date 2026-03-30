const youTubeVideoIdPattern =
  /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;

let cachedYouTubeSupportedRegionsPromise: Promise<
  YouTubeSupportedRegion[]
> | null = null;

export type YouTubeSupportedRegion = {
  code: string;
  name: string;
};

export type YouTubeRegionRestriction = {
  allowed?: string[] | null;
  blocked?: string[] | null;
};

export function getYouTubeVideoId(url: string) {
  const match = url.match(youTubeVideoIdPattern);
  const videoId = match?.[2];
  return videoId && videoId.length === 11 ? videoId : null;
}

export function parseYouTubeDurationSeconds(durationString?: string | null) {
  if (!durationString) {
    return 0;
  }

  const matches = durationString.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) {
    return 0;
  }

  const hours = Number.parseInt(matches[1] || "0", 10);
  const minutes = Number.parseInt(matches[2] || "0", 10);
  const seconds = Number.parseInt(matches[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

function normalizeRegionCodes(regionCodes?: string[] | null) {
  if (!regionCodes) {
    return null;
  }

  return [
    ...new Set(regionCodes.map((code) => code.trim().toUpperCase())),
  ].filter((code) => code.length === 2);
}

export function resolveBlockedYouTubeRegions(
  regionRestriction: YouTubeRegionRestriction | null | undefined,
  supportedRegions: readonly YouTubeSupportedRegion[],
) {
  if (!regionRestriction) {
    return [];
  }

  const blockedRegionCodes = normalizeRegionCodes(regionRestriction.blocked);
  const allowedRegionCodes = normalizeRegionCodes(regionRestriction.allowed);
  let resolvedBlockedCodes: string[] = [];

  if (blockedRegionCodes !== null) {
    resolvedBlockedCodes = blockedRegionCodes;
  } else if (allowedRegionCodes !== null) {
    const allowedSet = new Set(allowedRegionCodes);
    resolvedBlockedCodes = supportedRegions
      .map((region) => region.code)
      .filter((code) => !allowedSet.has(code));
  }

  const regionNameByCode = new Map(
    supportedRegions.map((region) => [region.code, region.name]),
  );

  return resolvedBlockedCodes
    .map((code) => ({
      code,
      name: regionNameByCode.get(code) ?? code,
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
    );
}

async function fetchYouTubeSupportedRegions(apiKey: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/i18nRegions");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("hl", "en");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch YouTube region catalog (${response.status}).`,
    );
  }

  const data = (await response.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        name?: string;
      };
    }>;
  };

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error(
      "YouTube region catalog response did not include any regions.",
    );
  }

  return data.items
    .map((item) => ({
      code: item.id?.trim().toUpperCase() ?? "",
      name: item.snippet?.name?.trim() ?? "",
    }))
    .filter((item) => item.code.length === 2 && item.name.length > 0)
    .sort((left, right) =>
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
    );
}

export async function getYouTubeSupportedRegions(apiKey: string) {
  if (!cachedYouTubeSupportedRegionsPromise) {
    cachedYouTubeSupportedRegionsPromise = fetchYouTubeSupportedRegions(
      apiKey,
    ).catch((error) => {
      cachedYouTubeSupportedRegionsPromise = null;
      throw error;
    });
  }

  return cachedYouTubeSupportedRegionsPromise;
}
