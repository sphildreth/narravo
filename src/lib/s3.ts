// SPDX-License-Identifier: Apache-2.0
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand, ListObjectsV2CommandOutput, _Object } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { getSafeUploadTypeByMime } from "./upload-validation";

export interface S3Config {
  region: string;
  endpoint?: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface PresignedPostData {
  url: string;
  fields: Record<string, string>;
  key: string;
}

export interface UploadValidationOptions {
  maxBytes: number;
  contentLength?: number;
  allowedMimeTypes?: string[];
  keyPrefix?: string;
}

export class S3Service {
  private client: S3Client;
  private bucket: string;

  constructor(private config: S3Config) {
    const clientConfig: any = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }

    this.client = new S3Client(clientConfig);
    this.bucket = config.bucket;
  }

  async createPresignedPost(
    filename: string,
    mimeType: string,
    options: UploadValidationOptions
  ): Promise<PresignedPostData> {
    const detected = getSafeUploadTypeByMime(mimeType);
    if (!detected) {
      throw new Error(`MIME type ${mimeType} is not supported`);
    }

    // Validate MIME type
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`MIME type ${mimeType} not allowed`);
    }

    if (
      typeof options.contentLength === "number" &&
      (!Number.isFinite(options.contentLength) || options.contentLength <= 0 || options.contentLength > options.maxBytes)
    ) {
      throw new Error(`Invalid content length ${options.contentLength}`);
    }

    // Generate unique key
    const keyPrefix = options.keyPrefix === "videos" ? "videos" : options.keyPrefix === "featured" ? "featured" : "images";
    const key = `${keyPrefix}/${nanoid()}.${detected.extension}`;
    
    // Create presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: detected.mimeType,
      ...(typeof options.contentLength === "number" ? { ContentLength: options.contentLength } : {}),
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: 300 });

    return {
      url,
      fields: {
        'Content-Type': detected.mimeType,
      },
      key,
    };
  }

  // New: simple helper to upload a buffer directly
  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await this.client.send(command);
  }

  async getObjectBytes(key: string, maxBytes: number): Promise<Uint8Array> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (typeof result.ContentLength === "number" && result.ContentLength > maxBytes) {
      throw new Error("Stored object exceeds upload limit");
    }
    if (!result.Body) throw new Error("Stored object has no body");
    const body = result.Body as any;
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (typeof body[Symbol.asyncIterator] === "function") {
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        total += bytes.byteLength;
        if (total > maxBytes) throw new Error("Stored object exceeds upload limit");
        chunks.push(bytes);
      }
    } else if (typeof body.transformToByteArray === "function") {
      // SDK mocks and non-streaming adapters may only expose this method. The
      // declared length was checked above; retain a post-read guard too.
      const bytes = new Uint8Array(await body.transformToByteArray());
      if (bytes.byteLength > maxBytes) throw new Error("Stored object exceeds upload limit");
      return bytes;
    } else {
      throw new Error("Stored object body is not readable");
    }
    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  }

  // New: delete a single object by key (best-effort)
  async deleteObject(key: string): Promise<void> {
    try {
      const cmd = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
      await this.client.send(cmd);
    } catch (err) {
      // swallow errors for idempotency; callers may ignore missing keys
    }
  }

  // New: delete all objects under a given prefix (handles pagination, batches up to 1000 per call)
  async deletePrefix(prefix: string): Promise<void> {
    let ContinuationToken: string | undefined = undefined;
    const cap = 1000;
    do {
      const list: ListObjectsV2CommandOutput = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken,
        MaxKeys: cap,
      }));

      const contents = (list.Contents ?? []) as _Object[];
      const keys: string[] = contents
        .map((obj: _Object) => obj.Key)
        .filter((k: string | undefined): k is string => typeof k === "string" && k.length > 0);

      if (keys.length > 0) {
        // Batch delete
        await this.client.send(new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: keys.map((k: string) => ({ Key: k })),
            Quiet: true,
          },
        }));
      }

      ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (ContinuationToken);
  }

  getPublicUrl(key: string): string {
    if (this.config.endpoint) {
      // For R2 or custom endpoints
      return `${this.config.endpoint}/${this.bucket}/${key}`;
    }
    // For AWS S3
    return `https://${this.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }
}

// Get S3 configuration from environment
export function getS3Config(): S3Config | null {
  const region = process.env.S3_REGION || process.env.R2_REGION;
  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET;

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
  };
}

// Get storage service (S3 or local filesystem fallback)
export function getStorageService(): S3Service | null {
  const s3Config = getS3Config();
  if (s3Config) {
    return new S3Service(s3Config);
    }
  return null; // Use local storage fallback in import script
}

export { validateFileType } from "./upload-validation";
