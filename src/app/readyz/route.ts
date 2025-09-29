// SPDX-License-Identifier: Apache-2.0
import { db } from "@/lib/db";
import { getS3Config } from "@/lib/s3";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { sql } from "drizzle-orm";
import logger from '@/lib/logger';

export const revalidate = 0; // Do not cache

async function checkDB() {
  await db.execute(sql`select 1`);
  return { ok: true, service: "database" };
}

async function checkS3() {
  const s3Config = getS3Config();
  if (!s3Config) {
    throw new Error("S3/R2 is not configured");
  }

  const clientConfig: any = {
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
    },
  };

  if (s3Config.endpoint) {
    clientConfig.endpoint = s3Config.endpoint;
  }

  const s3 = new S3Client(clientConfig);
  const command = new HeadBucketCommand({ Bucket: s3Config.bucket });
  await s3.send(command);

  return { ok: true, service: "s3" };
}

export async function GET() {
  const checks = await Promise.allSettled([
    checkDB(),
    checkS3(),
  ]);

  const errors: string[] = [];
  for (const result of checks) {
    if (result.status === "rejected") {
      errors.push(result.reason.message);
    }
  }

  if (errors.length > 0) {
    const errorMessage = `Readiness check failed: ${errors.join(", ")}`;
    logger.error(`/readyz error:`, errorMessage);
    return new Response(errorMessage, { status: 503 });
  }

  return new Response("OK", { status: 200 });
}
