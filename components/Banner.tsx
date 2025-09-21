// SPDX-License-Identifier: Apache-2.0
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

interface BannerProps {
  className?: string;
}

export default async function Banner({ className = "" }: BannerProps) {
  const config = new ConfigServiceImpl({ db });
  
  const enabled = await config.getBoolean("APPEARANCE.BANNER.ENABLED");
  if (!enabled) return null;
  
  const imageUrl = await config.getString("APPEARANCE.BANNER.IMAGE-URL");
  if (!imageUrl) return null;
  
  const alt = (await config.getString("APPEARANCE.BANNER.ALT")) ?? "";
  const credit = await config.getString("APPEARANCE.BANNER.CREDIT");
  const overlay = (await config.getNumber("APPEARANCE.BANNER.OVERLAY")) ?? 0.45;
  const focalX = (await config.getNumber("APPEARANCE.BANNER.FOCAL-X")) ?? 0.5;
  const focalY = (await config.getNumber("APPEARANCE.BANNER.FOCAL-Y")) ?? 0.5;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Responsive banner image */}
      <picture>
        <source
          media="(min-width: 1024px)"
          srcSet={`${imageUrl}?w=1200&h=400&fit=crop&auto=format 1x, ${imageUrl}?w=2400&h=800&fit=crop&auto=format 2x`}
        />
        <source
          media="(min-width: 768px)"
          srcSet={`${imageUrl}?w=768&h=300&fit=crop&auto=format 1x, ${imageUrl}?w=1536&h=600&fit=crop&auto=format 2x`}
        />
        <img
          src={`${imageUrl}?w=400&h=200&fit=crop&auto=format`}
          srcSet={`${imageUrl}?w=400&h=200&fit=crop&auto=format 1x, ${imageUrl}?w=800&h=400&fit=crop&auto=format 2x`}
          alt={alt}
          className="w-full h-48 md:h-72 lg:h-96 object-cover"
          style={{
            objectPosition: `${focalX * 100}% ${focalY * 100}%`
          }}
          loading="eager"
          decoding="async"
        />
      </picture>
      
      {/* Overlay */}
      {overlay > 0 && (
        <div 
          className="absolute inset-0 bg-black"
          style={{ opacity: overlay }}
          aria-hidden="true"
        />
      )}
      
      {/* Credit */}
      {credit && (
        <div className="absolute bottom-2 right-2 text-xs text-white/80 bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
          {credit}
        </div>
      )}
    </div>
  );
}