import { firstNonEmpty } from "../env";
import {
  buildSubmissionMediaPath,
} from "./delivery";

function getCloudflareZoneId(): string | null {
  return firstNonEmpty(process.env.CLOUDFLARE_ZONE_ID) ?? null;
}

function getCloudflareApiToken(): string | null {
  return firstNonEmpty(process.env.CLOUDFLARE_API_TOKEN) ?? null;
}

function getMediaPurgeBaseUrl(): string | null {
  return (
    firstNonEmpty(
      process.env.MEDIA_ORIGIN_BASE_URL,
      process.env.SITE_URL,
      process.env.MEDIA_DELIVERY_BASE_URL,
    )?.replace(
      /\/+$/u,
      "",
    ) ?? null
  );
}

export function canPurgeCloudflareMediaCache(): boolean {
  return Boolean(
    getCloudflareZoneId() &&
      getCloudflareApiToken() &&
      getMediaPurgeBaseUrl(),
  );
}

export function getSubmissionMediaPurgeUrls(submissionId: string): string[] {
  const baseUrl = getMediaPurgeBaseUrl();
  if (!baseUrl) {
    return [];
  }

  const audioUrl = new URL(
    buildSubmissionMediaPath(submissionId, "audio"),
    `${baseUrl}/`,
  );
  const audioDownloadUrl = new URL(audioUrl.toString());
  audioDownloadUrl.searchParams.set("download", "1");
  const artUrl = new URL(
    buildSubmissionMediaPath(submissionId, "art"),
    `${baseUrl}/`,
  );

  return [audioUrl.toString(), audioDownloadUrl.toString(), artUrl.toString()];
}

export async function purgeCloudflareMediaCache(
  submissionId: string,
): Promise<boolean> {
  const zoneId = getCloudflareZoneId();
  const apiToken = getCloudflareApiToken();
  const urls = getSubmissionMediaPurgeUrls(submissionId);

  if (!zoneId || !apiToken || urls.length === 0) {
    return false;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: urls }),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      responseText || `Cloudflare purge failed with status ${response.status}.`,
    );
  }

  return true;
}
