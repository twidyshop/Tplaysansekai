"use client";

import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith("/watch")) {
    return null;
  }

  return (
    <footer className="border-t border-white/10 bg-[#0a0e27]/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center">
          <p className="text-sm text-white/60">@ 2026 TPLAY • Short Drama Streaming</p>
        </div>
      </div>
    </footer>
  );
}
