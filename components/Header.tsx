import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import Image from "next/image";

export default async function Header() {
  const config = new ConfigServiceImpl({ db });
  const siteName = (await config.getString("SITE.NAME")) ?? "Narravo";
  const tagline = (await config.getString("SITE.TAGLINE")) ?? "A blog engine built for devs, loved by readers.";
  const description = (await config.getString("SITE.DESCRIPTION"));

  const imageUrl = (await config.getString("BANNER.IMAGE.URL")) ?? "https://images.unsplash.com/photo-1520509414578-d9cbf09933a1?q=80&w=1600&auto=format&fit=crop";
  const overlayFrom = Number((await config.getNumber("BANNER.OVERLAY.FROM")) ?? 10);
  const overlayVia = Number((await config.getNumber("BANNER.OVERLAY.VIA")) ?? 45);
  const overlayTo = Number((await config.getNumber("BANNER.OVERLAY.TO")) ?? 55);
  const brightness = Number((await config.getNumber("BANNER.BRIGHTNESS")) ?? 75);

  const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  const fromA = clampPct(overlayFrom) / 100;
  const viaA = clampPct(overlayVia) / 100;
  const toA = clampPct(overlayTo) / 100;
  const bgGradient = `linear-gradient(to bottom, rgba(0,0,0,${fromA}), rgba(0,0,0,${viaA}), rgba(0,0,0,${toA}))`;

  return (
    <header className="relative -mt-px text-white flex items-end overflow-hidden bg-[#111]" style={{ height: "min(38vh, 300px)" }}>
      <div className="absolute inset-0 bg-center bg-cover scale-[1.02]" style={{ backgroundImage: `url(${imageUrl})`, filter: `brightness(${clampPct(brightness)}%)` }} />
      <div className="absolute inset-0" style={{ backgroundImage: bgGradient }} />
      <div className="relative z-10 w-full max-w-screen mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <Image src="/images/logo-60x57.png" alt={`${siteName} logo`} width={36} height={34} className="inline-block rounded-lg" />
          <span className="font-extrabold tracking-wide text-xs uppercase opacity-90">{siteName}</span>
        </div>
        <h1 className="text-[clamp(28px,6vw,28px)] font-extrabold">{tagline}</h1>
        <p className="text-[clamp(14px,2.5vw,16px)] opacity-90 max-w-[64ch]">{description}</p>
      </div>
    </header>
  );
}
