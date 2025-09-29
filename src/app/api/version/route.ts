// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import { APP_VERSION, GIT_SHA, BUILD_TIME } from "@/version";

export async function GET() {
  return NextResponse.json({ 
    version: APP_VERSION, 
    git: GIT_SHA, 
    buildTime: BUILD_TIME 
  });
}