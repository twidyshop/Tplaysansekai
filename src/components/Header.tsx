"use client";

import Link from "next/link";
import { Play, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { WatchHistory } from "@/components/WatchHistory";
import { useWatchHistoryStore } from "@/hooks/useWatchHistory";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Memanggil store riwayat tontonan
  const addItem = useWatchHistoryStore((state) => state.addItem);

  // Efek pintar: Merekam riwayat otomatis, judul, poster, hingga nomor episode secara global
  useEffect(() => {
    if (pathname?.includes("/detail/") || pathname?.includes("/watch/")) {
      const segments = pathname.split("/");
      const platform = segments[2]; // Mendapatkan nama platform
      const id = segments[3];       // Mendapatkan ID drama

      if (id && platform) {
        // Beri sedikit jeda waktu (setTimeout) agar DOM halaman sempat merender elemen
        const timer = setTimeout(() => {
          const titleElement = document.querySelector("h1");
          const imageElement = document.querySelector("img[alt]") as HTMLImageElement;

          let dramaTitle = titleElement ? titleElement.innerText : "Drama Pilihan";
          
          // Deteksi nomor episode dari URL atau teks aktif di halaman (jika ada di halaman watch)
          const urlParams = new URLSearchParams(window.location.search);
          const epParam = urlParams.get("ep") || urlParams.get("episode") || segments[4];
          
          if (epParam) {
            dramaTitle += ` - Episode ${epParam}`;
          } else if (pathname.includes("/watch/")) {
            // Cek elemen teks episode di halaman watch jika menggunakan format teks
            const activeEpElement = document.querySelector(".episode-active, [data-active=true], .bg-primary");
            if (activeEpElement && activeEpElement.textContent) {
              dramaTitle += ` - Ep. ${activeEpElement.textContent.trim()}`;
            }
          }

          const dramaImage = imageElement ? imageElement.src : "";

          addItem({
            id: id,
            title: dramaTitle,
            image: dramaImage,
            platform: platform.charAt(0).toUpperCase() + platform.slice(1),
            timestamp: Date.now(),
            url: pathname + window.location.search
          });
        }, 600);

        return () => clearTimeout(timer);
      }
    }
  }, [pathname, addItem]);

  // Hook harus dipanggil sebelum return. Baris ini menyembunyikan header di halaman watch.
  if (pathname?.startsWith("/watch")) {
    return null;
  }

  // Fungsi untuk menangani pencarian saat Enter ditekan
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0a0e27]/95 backdrop-blur-2xl">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4 h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff5db1] via-[#7b61ff] to-[#5ad6ff]">
              <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-white text-white" />
            </div>
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                // Ubah text-xs menjadi text-base (16px) di layar kecil agar tidak auto-zoom
                className="h-9 sm:h-10 w-full rounded-full border border-white/15 bg-white/5 pl-9 sm:pl-10 pr-3 sm:pr-4 text-base sm:text-sm text-white placeholder:text-white/40 outline-none transition focus:border-[#7b61ff] focus:ring-1 focus:ring-[#7b61ff]/50"
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
