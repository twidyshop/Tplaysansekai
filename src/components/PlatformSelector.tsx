"use client";

import Image from "next/image";
import { usePlatform } from "@/hooks/usePlatform";

export function PlatformSelector() {
  const { currentPlatform, setPlatform, platforms } = usePlatform();

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-3 overflow-x-auto scrollbar-hide pb-2">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            onClick={() => setPlatform(platform.id)}
            className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl transition-all flex-shrink-0 ${
              currentPlatform === platform.id
                ? "bg-primary/20 ring-2 ring-primary shadow-lg"
                : "bg-muted/50 hover:bg-muted/80"
            }`}
          >
            <div className="relative w-10 h-10 rounded-lg overflow-hidden">
              <Image
                src={platform.logo}
                alt={platform.name}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <span className={`text-xs font-medium text-center line-clamp-1 ${
              currentPlatform === platform.id ? "text-primary" : "text-muted-foreground"
            }`}>
              {platform.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
