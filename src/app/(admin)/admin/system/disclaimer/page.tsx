// SPDX-License-Identifier: Apache-2.0
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import DisclaimerManager from "@/components/admin/disclaimer/DisclaimerManager";

// Ensure this admin page is always dynamic and not statically cached
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DisclaimerPage() {
  const config = new ConfigServiceImpl({ db });
  const opts = { bypassCache: true } as const;
  const enabled = (await config.getBoolean("SITE.DISCLAIMER.ENABLED", opts)) ?? false;
  const text = (await config.getString("SITE.DISCLAIMER.TEXT", opts)) ?? "";
  const style = (await config.getString("SITE.DISCLAIMER.STYLE", opts)) ?? "";

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold">Disclaimer</h1>
      <p className="opacity-70">Control the disclaimer content and settings.</p>
      <DisclaimerManager initial={{
        enabled,
        text,
        style,
      }} />
    </div>
  );
}
