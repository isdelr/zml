import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_URL_EXPIRY_SECONDS = 15 * 60;
type PutObjectBody = NonNullable<ConstructorParameters<typeof PutObjectCommand>[0]["Body"]>;
const SIGNED_URL_CACHE_TTL_MS = 60 * 1000;
const SIGNED_URL_CACHE_MAX_ENTRIES = 2000;

type StorageConfig = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

function loadStorageConfig(): StorageConfig {
  const bucket = process.env.B2_BUCKET;
  const endpoint = process.env.B2_ENDPOINT;
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing storage configuration. Set B2_BUCKET, B2_ENDPOINT, B2_KEY_ID, and B2_APPLICATION_KEY.",
    );
  }

  return {
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
    region: process.env.B2_REGION ?? "us-east-005",
    forcePathStyle: true,
  };
}

let cachedConfig: StorageConfig | null = null;
let cachedClient: S3Client | null = null;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function getStorageConfig(): StorageConfig {
  if (!cachedConfig) {
    cachedConfig = loadStorageConfig();
  }
  return cachedConfig;
}

function getStorageClient(): S3Client {
  if (!cachedClient) {
    const config = getStorageConfig();
    cachedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

function signedUrlCacheKey(bucket: string, key: string, expiresIn: number) {
  return `${bucket}:${key}:${expiresIn}`;
}

function getCachedSignedUrl(cacheKey: string) {
  const entry = signedUrlCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAt) {
    signedUrlCache.delete(cacheKey);
    return null;
  }
  return entry.url;
}

function setCachedSignedUrl(cacheKey: string, url: string) {
  if (signedUrlCache.size >= SIGNED_URL_CACHE_MAX_ENTRIES) {
    const oldestKey = signedUrlCache.keys().next().value;
    if (oldestKey) {
      signedUrlCache.delete(oldestKey);
    }
  }
  signedUrlCache.set(cacheKey, {
    url,
    expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS,
  });
}

function clearCachedSignedUrlsForKey(bucket: string, key: string) {
  const keyPrefix = `${bucket}:${key}:`;
  for (const cacheKey of signedUrlCache.keys()) {
    if (cacheKey.startsWith(keyPrefix)) {
      signedUrlCache.delete(cacheKey);
    }
  }
}

export class B2Storage {
  async putObject(
    key: string,
    body: PutObjectBody,
    options?: { contentType?: string; contentLength?: number },
  ) {
    const config = getStorageConfig();
    clearCachedSignedUrlsForKey(config.bucket, key);
    await getStorageClient().send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        ContentLength: options?.contentLength,
      }),
    );
  }

  async getUrl(key: string, options?: { expiresIn?: number }) {
    const config = getStorageConfig();
    const expiresIn = options?.expiresIn ?? DEFAULT_URL_EXPIRY_SECONDS;
    const cacheKey = signedUrlCacheKey(config.bucket, key, expiresIn);
    const cachedUrl = getCachedSignedUrl(cacheKey);
    if (cachedUrl) {
      return cachedUrl;
    }
    const url = await getSignedUrl(
      getStorageClient(),
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      { expiresIn },
    );
    setCachedSignedUrl(cacheKey, url);
    return url;
  }

  async generateUploadUrl(customKey?: string) {
    const key = customKey ?? crypto.randomUUID();
    const config = getStorageConfig();
    const url = await getSignedUrl(
      getStorageClient(),
      new PutObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    return { key, url };
  }

  async deleteObject(key: string) {
    const config = getStorageConfig();
    clearCachedSignedUrlsForKey(config.bucket, key);
    await getStorageClient().send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
  }
}
