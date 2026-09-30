"use client";

import Link from "next/link";
import { Play, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { WatchHistory } from "@/components/WatchHistory";

export function Header() {
  const pathname = usePathname();

  if (pathname?.startsWith("/watch")) {
    return null;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0a0e27]/95 backdrop-blur-2xl">
      <div className="container mx-auto px-2 sm:px-4">
        {/* Mengubah gap menjadi lebih kecil di HP (gap-2) agar semua muat */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff5db1] via-[#7b61ff] to-[#5ad6ff]">
              <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-white text-white" />
            </div>
            {/* Class 'hidden sm:block' dihapus agar teks selalu muncul */}
            <span className="font-bold text-base sm:text-lg text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              TPLAY+
            </span>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 flex justify-center max-w-md ml-1 sm:ml-0">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input
                type="text"
                placeholder="Cari drama..."
                className="h-9 sm:h-10 w-full rounded-full border border-white/15 bg-white/5 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm text-white placeholder:text-white/40 outline-none transition focus:border-[#7b61ff] focus:ring-1 focus:ring-[#7b61ff]/50"
              />
            </div>
          </div>

          {/* Watch History & Actions */}
          <div className="flex items-center flex-shrink-0">
            <WatchHistory />
          </div>
        </div>
      </div>
    </header>
  );
}
