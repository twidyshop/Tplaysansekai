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

  const addItem = useWatchHistoryStore((state) => state.addItem);

  useEffect(() => {
    if (
      !pathname?.includes("/detail/") &&
      !pathname?.includes("/watch/")
    ) {
      return;
    }

    const segments = pathname.split("/").filter(Boolean);

    /*
     * Format:
     *
     * /detail/platform/bookId
     * /watch/platform/bookId/...
     */
    const mode = segments[0];
    const platform = segments[1];
    const dramaId = segments[2];

    if (!platform || !dramaId) {
      return;
    }

    const timer = setTimeout(() => {
      /*
       * Ambil judul dari halaman.
       * Tetap menggunakan mekanisme lama supaya semua
       * platform yang sudah bekerja tidak perlu diubah.
       */
      const titleElement = document.querySelector("h1");

      const imageElement = document.querySelector(
        "img[alt]"
      ) as HTMLImageElement | null;

      let dramaTitle =
        titleElement?.innerText?.trim() ||
        "Drama Pilihan";

      /*
       * Jangan sampai judul lama yang sudah pernah dibuat
       * menjadi:
       *
       * "Judul - Episode 12"
       *
       * ikut tersimpan lagi sebagai judul.
       */
      dramaTitle = dramaTitle
        .replace(/\s*[-–—]\s*Episode\s+\d+\s*$/i, "")
        .replace(/\s*[-–—]\s*Ep\.?\s*\d+\s*$/i, "")
        .trim();

      /*
       * ============================================
       * DETEKSI EPISODE
       * ============================================
       *
       * Kita mencoba beberapa sumber supaya universal
       * untuk semua platform.
       */

      const urlParams = new URLSearchParams(
        window.location.search
      );

      let episode: number | undefined;

      // ?ep=12
      // ?episode=12
      const queryEpisode =
        urlParams.get("ep") ||
        urlParams.get("episode") ||
        urlParams.get("episodeNumber");

      if (queryEpisode) {
        const parsed = Number(
          queryEpisode.replace(/\D/g, "")
        );

        if (Number.isFinite(parsed) && parsed > 0) {
          episode = parsed;
        }
      }

      /*
       * Coba ambil angka dari segment URL setelah ID drama.
       *
       * Contoh:
       * /watch/meloshort/ABC/12
       */
      if (!episode && mode === "watch") {
        const possibleSegments = segments.slice(3);

        for (const segment of possibleSegments) {
          const decoded = decodeURIComponent(segment);

          /*
           * Hanya ambil segment yang benar-benar terlihat
           * seperti nomor episode.
           */
          const match = decoded.match(
            /^(?:episode|ep)?[-_ ]?(\d+)$/i
          );

          if (match) {
            const parsed = Number(match[1]);

            if (
              Number.isFinite(parsed) &&
              parsed > 0
            ) {
              episode = parsed;
              break;
            }
          }
        }
      }

      /*
       * Coba cari teks episode aktif di halaman.
       * Ini berguna untuk platform yang tidak memasukkan
       * nomor episode ke URL.
       */
      if (!episode && mode === "watch") {
        const selectors = [
          ".episode-active",
          "[data-active='true']",
          "[data-active=true]",
          "[aria-current='true']",
          ".bg-primary",
        ];

        for (const selector of selectors) {
          const elements =
            document.querySelectorAll(selector);

          for (const element of elements) {
            const text =
              element.textContent?.trim() || "";

            const match = text.match(
              /(?:episode|ep\.?)?\s*(\d+)/i
            );

            if (match) {
              const parsed = Number(match[1]);

              if (
                Number.isFinite(parsed) &&
                parsed > 0
              ) {
                episode = parsed;
                break;
              }
            }
          }

          if (episode) break;
        }
      }

      /*
       * ============================================
       * TOTAL EPISODE
       * ============================================
       */

      let totalEpisodes: number | undefined;

      /*
       * Cari pola seperti:
       *
       * Episode 12 / 100
       * 12 / 100
       * 100 Episodes
       */
      const pageText =
        document.body?.innerText || "";

      const totalPatterns = [
        /Episode\s+\d+\s*\/\s*(\d+)/i,
        /\b\d+\s*\/\s*(\d+)\b/,
        /(\d+)\s+Episodes?/i,
        /(\d+)\s+Episode/i,
      ];

      for (const pattern of totalPatterns) {
        const match = pageText.match(pattern);

        if (match) {
          const parsed = Number(match[1]);

          if (
            Number.isFinite(parsed) &&
            parsed > 0
          ) {
            totalEpisodes = parsed;
            break;
          }
        }
      }

      /*
       * Cari juga elemen yang mungkin memiliki jumlah
       * episode melalui atribut data.
       */
      if (!totalEpisodes) {
        const totalElement =
          document.querySelector(
            "[data-total-episodes]"
          );

        const value =
          totalElement?.getAttribute(
            "data-total-episodes"
          );

        if (value) {
          const parsed = Number(value);

          if (
            Number.isFinite(parsed) &&
            parsed > 0
          ) {
            totalEpisodes = parsed;
          }
        }
      }

      const dramaImage =
        imageElement?.src || "";

      /*
       * ============================================
       * DETAIL PAGE
       * ============================================
       *
       * Kalau user cuma membuka detail, jangan
       * menimpa episode terakhir yang sudah ditonton.
       *
       * Kita tetap menambahkan drama ke history jika
       * belum ada, tetapi kalau sudah ada, episode
       * sebelumnya dipertahankan.
       */

      const currentItems =
        useWatchHistoryStore.getState().items;

      const historyId =
        `${platform.toLowerCase()}:${dramaId}`;

      const existing = currentItems.find((item) => {
        const existingId =
          `${item.platform.toLowerCase()}:${item.id}`;

        return (
          item.id === historyId ||
          existingId === historyId ||
          (
            item.id === dramaId &&
            item.platform.toLowerCase() ===
              platform.toLowerCase()
          )
        );
      });

      /*
       * Jika membuka detail dan history sudah ada,
       * jangan mengubah episode terakhir.
       */
      if (
        mode === "detail" &&
        existing
      ) {
        return;
      }

      /*
       * Kalau dari watch page, simpan episode terbaru.
       * URL yang disimpan juga adalah URL episode tersebut,
       * sehingga klik history dapat melanjutkan tontonan.
       */
      addItem({
        id: dramaId,
        title: dramaTitle,
        image: dramaImage,
        platform:
          platform.charAt(0).toUpperCase() +
          platform.slice(1),
        timestamp: Date.now(),
        url:
          pathname +
          window.location.search +
          window.location.hash,
        episode,
        totalEpisodes,
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [pathname, addItem]);

  /*
   * Header memang disembunyikan di halaman watch.
   * Ini dipertahankan agar player tidak berubah.
   */
  if (pathname?.startsWith("/watch")) {
    return null;
  }

  const handleSearch = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      e.key === "Enter" &&
      searchQuery.trim()
    ) {
      router.push(
        `/search?q=${encodeURIComponent(
          searchQuery.trim()
        )}`
      );
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0a0e27]/95 backdrop-blur-2xl">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4 h-16">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff5db1] via-[#7b61ff] to-[#5ad6ff]">
              <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-white text-white" />
            </div>

            <span
              className="font-bold text-base sm:text-lg text-white"
              style={{
                fontFamily:
                  "'Space Grotesk', sans-serif",
              }}
            >
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
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                onKeyDown={handleSearch}
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
