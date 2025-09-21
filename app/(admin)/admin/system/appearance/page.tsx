// SPDX-License-Identifier: Apache-2.0
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import AppearanceManager from "@/components/admin/appearance/AppearanceManager";

export default async function AppearancePage() {
  const config = new ConfigServiceImpl({ db });
  const themeDefault = (await config.getString("THEME.DEFAULT")) === "dark" ? "dark" : "light";
  const bannerUrl = (await config.getString("BANNER.IMAGE.URL")) ?? "https://images.unsplash.com/photo-1520509414578-d9cbf09933a1?q=80&w=1600&auto=format&fit=crop";
  const overlayFrom = Number((await config.getNumber("BANNER.OVERLAY.FROM")) ?? 10);
  const overlayVia = Number((await config.getNumber("BANNER.OVERLAY.VIA")) ?? 45);
  const overlayTo = Number((await config.getNumber("BANNER.OVERLAY.TO")) ?? 55);
  const brightness = Number((await config.getNumber("BANNER.BRIGHTNESS")) ?? 75);

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold">Appearance</h1>
      <p className="opacity-70">Control the default theme and banner styling.</p>
      <AppearanceManager initial={{ themeDefault, bannerUrl, overlayFrom, overlayVia, overlayTo, brightness }} />
    </div>
  );
}
