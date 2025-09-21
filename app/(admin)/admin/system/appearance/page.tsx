// SPDX-License-Identifier: Apache-2.0
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import AppearanceManager from "@/components/admin/appearance/AppearanceManager";

export default async function AppearancePage() {
  const config = new ConfigServiceImpl({ db });
  const bannerEnabled = (await config.getBoolean("APPEARANCE.BANNER.ENABLED")) ?? false;
  const bannerImageUrl = (await config.getString("APPEARANCE.BANNER.IMAGE-URL")) ?? "";
  const bannerAlt = (await config.getString("APPEARANCE.BANNER.ALT")) ?? "";
  const bannerCredit = (await config.getString("APPEARANCE.BANNER.CREDIT")) ?? "";
  const bannerOverlay = (await config.getNumber("APPEARANCE.BANNER.OVERLAY")) ?? 0.45;
  const bannerFocalX = (await config.getNumber("APPEARANCE.BANNER.FOCAL-X")) ?? 0.5;
  const bannerFocalY = (await config.getNumber("APPEARANCE.BANNER.FOCAL-Y")) ?? 0.5;

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
