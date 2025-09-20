import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

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
    // Validate MIME type
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`MIME type ${mimeType} not allowed`);
    }

    // Generate unique key
    const ext = filename.split('.').pop() || '';
    const key = `${options.keyPrefix || 'uploads'}/${nanoid()}.${ext}`;
    
    // Create presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: 300 });

    return {
      url,
      fields: {
        'Content-Type': mimeType,
      },
      key,
    };
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

// Helper function to validate file size from magic numbers
export function validateFileType(buffer: ArrayBuffer, expectedMime: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  
  // Common image formats
  if (expectedMime.startsWith('image/')) {
    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return expectedMime === 'image/png';
    }
    // JPEG
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return expectedMime === 'image/jpeg';
    }
    // GIF
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return expectedMime === 'image/gif';
    }
    // WebP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return expectedMime === 'image/webp';
    }
  }
  
  // Common video formats
  if (expectedMime.startsWith('video/')) {
    // MP4
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return expectedMime === 'video/mp4';
    }
    // WebM
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return expectedMime === 'video/webm';
    }
  }
  
  return false;
}