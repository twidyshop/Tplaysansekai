"use client";

import Image from "next/image";
import { usePlatform } from "@/hooks/usePlatform";

export function PlatformSelector() {
  const { currentPlatform, setPlatform, platforms } = usePlatform();

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            onClick={() => setPlatform(platform.id)}
            className={`flex flex-shrink-0 items-center justify-center rounded-2xl border px-4 py-3 transition-all duration-200 ${
              currentPlatform === platform.id
                ? "border-[#7b61ff] bg-[#1a2245] shadow-[0_0_20px_rgba(123,97,255,0.35)]"
                : "border-white/10 bg-[#121a32]/80 hover:border-white/20 hover:bg-[#171f38]"
            }`}
            style={{ minWidth: "108px" }}
          >
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-[#0d142d]">
                <Image
                  src={platform.logo}
                  alt={platform.name}
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </div>
              <span className="text-base font-semibold text-white">{platform.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
