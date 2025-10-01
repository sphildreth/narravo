// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import AboutMeManager from "@/components/admin/about-me/AboutMeManager";

// Ensure this admin page is always dynamic and not statically cached
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AboutMePage() {
  await requireAdmin2FA();

  const config = new ConfigServiceImpl({ db });
  const opts = { bypassCache: true } as const;
  const enabled = (await config.getBoolean("SITE.ABOUT-ME.ENABLED", opts)) ?? false;
  const title = (await config.getString("SITE.ABOUT-ME.TITLE", opts)) ?? "";
  const content = (await config.getString("SITE.ABOUT-ME.CONTENT", opts)) ?? "";

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold">About Me</h1>
      <p className="opacity-70">Control the about me section content and settings.</p>
      <AboutMeManager initial={{
        enabled,
        title,
        content,
      }} />
    </div>
  );
}
