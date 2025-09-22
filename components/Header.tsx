// SPDX-License-Identifier: Apache-2.0
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import Image from "next/image";

export default async function Header() {
  const config = new ConfigServiceImpl({ db });

  // Site copy
  const siteName = (await config.getString("SITE.NAME")) ?? "Narravo";
  const tagline =
    (await config.getString("SITE.TAGLINE")) ??
    "A blog engine built for devs, loved by readers.";
  const description = await config.getString("SITE.DESCRIPTION");

  // Appearance/Banner settings (from Admin -> Appearance)
  const bannerEnabled = (await config.getBoolean("APPEARANCE.BANNER.ENABLED")) ?? false;
  const imageUrl = await config.getString("APPEARANCE.BANNER.IMAGE-URL");
  const bannerAlt = (await config.getString("APPEARANCE.BANNER.ALT")) ?? "";
  const bannerCredit = (await config.getString("APPEARANCE.BANNER.CREDIT")) ?? "";
  const overlayAlphaRaw = await config.getNumber("APPEARANCE.BANNER.OVERLAY");
  const focalXRaw = (await config.getNumber("APPEARANCE.BANNER.FOCAL-X")) ?? 0.5;
  const focalYRaw = (await config.getNumber("APPEARANCE.BANNER.FOCAL-Y")) ?? 0.5;

  // Legacy/fallback settings (kept for backward compatibility)
  const overlayFrom = Number((await config.getNumber("BANNER.OVERLAY.FROM")) ?? 10);
  const overlayVia = Number((await config.getNumber("BANNER.OVERLAY.VIA")) ?? 45);
  const overlayTo = Number((await config.getNumber("BANNER.OVERLAY.TO")) ?? 55);
  const brightness = Number((await config.getNumber("BANNER.BRIGHTNESS")) ?? 75);

  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

  const focalX = clamp01(Number.isFinite(focalXRaw) ? Number(focalXRaw) : 0.5);
  const focalY = clamp01(Number.isFinite(focalYRaw) ? Number(focalYRaw) : 0.5);
  const objectPosition = `${focalX * 100}% ${focalY * 100}%`;

  // Prefer new single overlay alpha if provided; otherwise fall back to legacy gradient stops
  const overlayAlpha =
    typeof overlayAlphaRaw === "number" && Number.isFinite(overlayAlphaRaw)
      ? clamp01(Number(overlayAlphaRaw))
      : null;

  const fromA = clampPct(overlayFrom) / 100;
  const viaA = clampPct(overlayVia) / 100;
  const toA = clampPct(overlayTo) / 100;
  const legacyGradient = `linear-gradient(to bottom, rgba(0,0,0,${fromA}), rgba(0,0,0,${viaA}), rgba(0,0,0,${toA}))`;

  const headerHeight = "min(38vh, 300px)";

  return (
    <header
      className="relative -mt-px text-white flex items-end overflow-hidden bg-[#111]"
      style={{ height: headerHeight }}
      aria-label={bannerAlt || undefined}
    >
      {bannerEnabled && imageUrl ? (
        <>
          {/* Background image using Next/Image with object-position to match admin preview */}
          <Image
            src={imageUrl}
            alt={bannerAlt || ""}
            fill
            priority
            sizes="100vw"
            style={{
              objectFit: "cover",
              objectPosition,
              filter: `brightness(${clampPct(brightness)}%)`,
            }}
          />

          {/* Overlay (new single alpha or legacy gradient) */}
          <div
            className="absolute inset-0"
            style={
              overlayAlpha !== null
                ? { backgroundColor: `rgba(0,0,0,${overlayAlpha})` }
                : { backgroundImage: legacyGradient }
            }
            aria-hidden
          />
        </>
      ) : null}

      <div className="relative z-10 w-full max-w-screen mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <Image
            src="/images/logo-60x57.png"
            alt={`${siteName} logo`}
            width={36}
            height={34}
            className="inline-block rounded-lg"
            priority
          />
          <span className="font-extrabold tracking-wide text-xs uppercase opacity-90">
            {siteName}
          </span>
        </div>
        <h1 className="text-[clamp(28px,6vw,28px)] font-extrabold">{tagline}</h1>
        <p className="text-[clamp(14px,2.5vw,16px)] opacity-90 max-w-[64ch]">{description}</p>
      </div>

      {/* Optional credit text when banner is enabled */}
      {bannerEnabled && bannerCredit ? (
        <div className="absolute right-2 bottom-2 z-10 text-[11px] opacity-70">
          {bannerCredit}
        </div>
      ) : null}
    </header>
  );
}
