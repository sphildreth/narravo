// SPDX-License-Identifier: Apache-2.0
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

export default async function Banner() {
  const config = new ConfigServiceImpl({ db });
  const bannerEnabled = (await config.getBoolean("APPEARANCE.BANNER.ENABLED")) ?? false;

  if (!bannerEnabled) {
    return null;
  }

  const bannerImageUrl = (await config.getString("APPEARANCE.BANNER.IMAGE-URL")) ?? "";
  const bannerAlt = (await config.getString("APPEARANCE.BANNER.ALT")) ?? "";
  const bannerCredit = (await config.getString("APPEARANCE.BANNER.CREDIT")) ?? "";
  const bannerOverlay = (await config.getNumber("APPEARANCE.BANNER.OVERLAY")) ?? 0.45;
  const bannerFocalX = (await config.getNumber("APPEARANCE.BANNER.FOCAL-X")) ?? 0.5;
  const bannerFocalY = (await config.getNumber("APPEARANCE.BANNER.FOCAL-Y")) ?? 0.5;

  if (!bannerImageUrl) {
    return null;
  }

  return (
    <div className="relative w-full h-64 overflow-hidden">
      <img
        src={bannerImageUrl}
        alt={bannerAlt}
        className="w-full h-full object-cover"
        style={{
          objectPosition: `${bannerFocalX * 100}% ${bannerFocalY * 100}%`,
        }}
      />
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: bannerOverlay }}
      />
      {bannerCredit && (
        <div className="absolute bottom-2 right-2 text-white text-xs opacity-75">
          {bannerCredit}
        </div>
      )}
    </div>
  );
}
