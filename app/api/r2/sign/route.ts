import { NextRequest } from "next/server";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
export async function POST(req: NextRequest) {
  const config = new ConfigServiceImpl({ db });
  const imageMax = await config.getNumber("UPLOADS.IMAGE-MAX-BYTES");
  const videoMax = await config.getNumber("UPLOADS.VIDEO-MAX-BYTES");
  const videoMaxDuration = await config.getNumber("UPLOADS.VIDEO-MAX-DURATION-SECONDS");
  if (imageMax == null) throw new Error("Missing required config: UPLOADS.IMAGE-MAX-BYTES");
  if (videoMax == null) throw new Error("Missing required config: UPLOADS.VIDEO-MAX-BYTES");
  if (videoMaxDuration == null) throw new Error("Missing required config: UPLOADS.VIDEO-MAX-DURATION-SECONDS");
  // Placeholder: in MVP we don’t generate a real presigned URL here
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind ?? "image";
  const policy = {
    kind,
    limits: {
      imageMaxBytes: imageMax,
      videoMaxBytes: videoMax,
      videoMaxDurationSeconds: videoMaxDuration,
    },
  };
  return new Response(JSON.stringify({ url: "https://example.com/presigned", policy }), { status: 200 });
}
