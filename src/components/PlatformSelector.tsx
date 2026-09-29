"use client";

import Image from "next/image";
import { usePlatform } from "@/hooks/usePlatform";

export function PlatformSelector() {
  const { currentPlatform, setPlatform, platforms } = usePlatform();

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-white/80 mb-3">Platform</h3>
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            onClick={() => setPlatform(platform.id)}
            className={`flex flex-shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 transition-all duration-200 ${
              currentPlatform === platform.id
                ? "border-[#7b61ff] bg-[#1a2245]/80 shadow-[0_0_15px_rgba(123,97,255,0.3)]"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            <div className="relative h-7 w-7 overflow-hidden rounded-md">
              <Image
                src={platform.logo}
                alt={platform.name}
                fill
                className="object-cover"
                sizes="28px"
              />
            </div>
            <span className="text-sm font-medium text-white whitespace-nowrap">{platform.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
