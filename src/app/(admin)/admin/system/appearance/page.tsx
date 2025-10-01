// SPDX-License-Identifier: Apache-2.0
import { requireAdmin2FA } from "@/lib/auth";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import AppearanceManager from "@/components/admin/appearance/AppearanceManager";

export default async function AppearancePage() {
  await requireAdmin2FA();

  const config = new ConfigServiceImpl({ db });
  const opts = { bypassCache: true } as const;
  const bannerEnabled = (await config.getBoolean("APPEARANCE.BANNER.ENABLED", opts)) ?? false;
  const bannerImageUrl = (await config.getString("APPEARANCE.BANNER.IMAGE-URL", opts)) ?? "";
  const bannerAlt = (await config.getString("APPEARANCE.BANNER.ALT", opts)) ?? "";
  const bannerCredit = (await config.getString("APPEARANCE.BANNER.CREDIT", opts)) ?? "";
  const bannerOverlay = (await config.getNumber("APPEARANCE.BANNER.OVERLAY", opts)) ?? 0.45;
  const bannerFocalX = (await config.getNumber("APPEARANCE.BANNER.FOCAL-X", opts)) ?? 0.5;
  const bannerFocalY = (await config.getNumber("APPEARANCE.BANNER.FOCAL-Y", opts)) ?? 0.5;

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold">Appearance</h1>
      <p className="opacity-70">Control the banner styling and settings.</p>
      <AppearanceManager initial={{ 
        bannerEnabled, 
        bannerImageUrl, 
        bannerAlt, 
        bannerCredit, 
        bannerOverlay, 
        bannerFocalX, 
        bannerFocalY 
      }} />
    </div>
  );
}
