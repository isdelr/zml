import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type PutObjectBody = NonNullable<ConstructorParameters<typeof PutObjectCommand>[0]["Body"]>;

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

export class B2Storage {
  async putObject(
    key: string,
    body: PutObjectBody,
    options?: { contentType?: string; contentLength?: number },
  ) {
    const config = getStorageConfig();
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

  async getObject(key: string, options?: { range?: string }) {
    const config = getStorageConfig();
    return await getStorageClient().send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Range: options?.range,
      }),
    );
  }

  async headObject(key: string) {
    const config = getStorageConfig();
    return await getStorageClient().send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
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

  async createMultipartUpload(key: string, options?: { contentType?: string }) {
    const config = getStorageConfig();
    const response = await getStorageClient().send(
      new CreateMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: options?.contentType,
      }),
    );

    if (!response.UploadId) {
      throw new Error("Storage provider did not return a multipart upload ID.");
    }

    return { uploadId: response.UploadId };
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: PutObjectBody,
    options?: { contentLength?: number },
  ) {
    const config = getStorageConfig();
    const response = await getStorageClient().send(
      new UploadPartCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
        ContentLength: options?.contentLength,
      }),
    );

    if (!response.ETag) {
      throw new Error("Storage provider did not return a multipart part ETag.");
    }

    return { etag: response.ETag };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ) {
    const config = getStorageConfig();
    await getStorageClient().send(
      new CompleteMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string) {
    const config = getStorageConfig();
    await getStorageClient().send(
      new AbortMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async deleteObject(key: string) {
    const config = getStorageConfig();
    await getStorageClient().send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
  }

  async listObjects(options?: { prefix?: string; continuationToken?: string; maxKeys?: number }) {
    const config = getStorageConfig();
    const response = await getStorageClient().send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: options?.prefix,
        ContinuationToken: options?.continuationToken,
        MaxKeys: options?.maxKeys,
      }),
    );

    return {
      keys: (response.Contents ?? [])
        .map((item) => item.Key)
        .filter((key): key is string => typeof key === "string" && key.length > 0),
      nextContinuationToken: response.NextContinuationToken ?? null,
      isTruncated: response.IsTruncated ?? false,
    };
  }
}
