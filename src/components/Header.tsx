"use client";

import Link from "next/link";
import { Play, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { WatchHistory } from "@/components/WatchHistory";
import { useWatchHistoryStore } from "@/hooks/useWatchHistory";
import { getWatchSession } from "@/lib/watch-session";

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
     * Format umum:
     *
     * /detail/platform/bookId
     * /watch/platform/bookId/...
     *
     * Beberapa platform juga mempunyai token di:
     *
     * /watch/platform/bookId/token
     */

    const mode = segments[0];
    const platform = segments[1];
    const dramaId = segments[2];

    if (!platform || !dramaId) {
      return;
    }

    /*
     * MeloShort dikelola langsung oleh halaman player.
     * Halaman detail MeloShort tidak boleh otomatis masuk
     * ke Watch History, dan Header juga tidak boleh membuat
     * item "Drama Pilihan" sebelum player benar-benar dibuka.
     *
     * History MeloShort akan dibuat/diperbarui oleh:
     * /watch/meloshort/[bookId]/page.tsx
     */
    if (platform.toLowerCase() === "meloshort") {
      return;
    }

    const timer = setTimeout(() => {
      /*
       * ============================================
       * AMBIL DATA DASAR DRAMA
       * ============================================
       */

      const titleElement = document.querySelector("h1");

      const imageElement = document.querySelector(
        "img[alt]"
      ) as HTMLImageElement | null;

      let dramaTitle =
        titleElement?.innerText?.trim() ||
        "Drama Pilihan";

      /*
       * Jangan sampai judul episode ikut tersimpan:
       *
       * "Judul Drama - Episode 12"
       * "Judul Drama - Ep. 12"
       */

      dramaTitle = dramaTitle
        .replace(
          /\s*[-–—]\s*Episode\s+\d+\s*$/i,
          ""
        )
        .replace(
          /\s*[-–—]\s*Ep\.?\s*\d+\s*$/i,
          ""
        )
        .trim();

      /*
       * ============================================
       * DETEKSI EPISODE
       * ============================================
       *
       * Prioritas:
       *
       * 1. watch-session
       * 2. query parameter
       * 3. URL segment
       * 4. DOM fallback
       *
       * watch-session adalah sumber paling akurat
       * karena halaman watch memang sudah menyimpan
       * episode aktif di sana.
       */

      const urlParams = new URLSearchParams(
        window.location.search
      );

      let episode: number | undefined;

      /*
       * ============================================
       * 1. WATCH SESSION
       * ============================================
       *
       * Sebagian besar platform menggunakan random
       * token untuk URL watch.
       *
       * Contoh:
       *
       * /watch/shortmax/ABC?t=xxxx
       * /watch/reelshort/ABC?t=xxxx
       * /watch/goodshort/ABC/xxxx
       */

      let watchToken =
        urlParams.get("t") || "";

      /*
       * GoodShort menggunakan token sebagai segment
       * terakhir URL:
       *
       * /watch/goodshort/bookId/token
       *
       * Jika tidak ada ?t=, gunakan segment terakhir.
       */
      if (
        !watchToken &&
        mode === "watch" &&
        segments.length > 3
      ) {
        const possibleToken =
          segments[segments.length - 1];

        /*
         * Token watch-session adalah random
         * alphanumeric. Hindari menganggap angka
         * episode biasa sebagai token.
         */
        if (
          possibleToken &&
          !/^(?:episode|ep)?[-_ ]?\d+$/i.test(
            possibleToken
          )
        ) {
          watchToken = decodeURIComponent(
            possibleToken
          );
        }
      }

      if (
        mode === "watch" &&
        watchToken
      ) {
        try {
          const session =
            getWatchSession(watchToken);

          if (session) {
            /*
             * episodeNumber memang sudah 1-based
             * pada platform yang menggunakannya.
             */
            if (
              typeof session.episodeNumber ===
                "number" &&
              Number.isFinite(
                session.episodeNumber
              ) &&
              session.episodeNumber > 0
            ) {
              episode =
                session.episodeNumber;
            }

            /*
             * DramaBox menggunakan episodeIndex
             * 0-based:
             *
             * 0 = Episode 1
             * 1 = Episode 2
             */
            if (
              !episode &&
              typeof session.episodeIndex ===
                "number" &&
              Number.isFinite(
                session.episodeIndex
              )
            ) {
              if (
                platform.toLowerCase() ===
                "dramabox"
              ) {
                episode =
                  session.episodeIndex + 1;
              }
              /*
               * GoodShort saat ini menyimpan
               * episodeIndex dalam bentuk 1-based.
               *
               * Halaman GoodShort sendiri menggunakan:
               *
               * (session?.episodeIndex || 1) - 1
               *
               * sehingga nilai session adalah nomor
               * episode langsung.
               */
              else if (
                platform.toLowerCase() ===
                "goodshort"
              ) {
                if (
                  session.episodeIndex > 0
                ) {
                  episode =
                    session.episodeIndex;
                }
              }
              /*
               * Untuk platform lain yang belum
               * menggunakan episodeNumber maupun
               * konvensi khusus, pertahankan
               * fallback lama: anggap index 0-based.
               */
              else if (
                session.episodeIndex >= 0
              ) {
                episode =
                  session.episodeIndex + 1;
              }
            }
          }
        } catch (error) {
          console.warn(
            "Gagal membaca watch session:",
            error
          );
        }
      }

      /*
       * ============================================
       * 2. QUERY PARAMETER
       * ============================================
       *
       * Fallback ini penting untuk MeloShort:
       *
       * /watch/meloshort/ABC?episode=12
       */

      if (!episode) {
        const queryEpisode =
          urlParams.get("ep") ||
          urlParams.get("episode") ||
          urlParams.get("episodeNumber");

        if (queryEpisode) {
          const parsed = Number(
            queryEpisode.replace(/\D/g, "")
          );

          if (
            Number.isFinite(parsed) &&
            parsed > 0
          ) {
            episode = parsed;
          }
        }
      }

      /*
       * ============================================
       * 3. URL SEGMENT
       * ============================================
       *
       * Contoh:
       *
       * /watch/platform/ABC/12
       */

      if (
        !episode &&
        mode === "watch"
      ) {
        const possibleSegments =
          segments.slice(3);

        for (const segment of possibleSegments) {
          const decoded =
            decodeURIComponent(segment);

          const match =
            decoded.match(
              /^(?:episode|ep)?[-_ ]?(\d+)$/i
            );

          if (match) {
            const parsed =
              Number(match[1]);

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
       * ============================================
       * 4. DOM FALLBACK
       * ============================================
       *
       * Tetap dipertahankan sebagai fallback supaya
       * platform yang tidak menggunakan watch-session
       * masih bisa dicatat.
       */

      if (
        !episode &&
        mode === "watch"
      ) {
        const selectors = [
          ".episode-active",
          "[data-active='true']",
          "[data-active=true]",
          "[aria-current='true']",
          ".bg-primary",
        ];

        for (const selector of selectors) {
          const elements =
            document.querySelectorAll(
              selector
            );

          for (const element of elements) {
            const text =
              element.textContent?.trim() ||
              "";

            const match =
              text.match(
                /(?:episode|ep\.?)\s*(\d+)/i
              );

            if (match) {
              const parsed =
                Number(match[1]);

              if (
                Number.isFinite(parsed) &&
                parsed > 0
              ) {
                episode = parsed;
                break;
              }
            }
          }

          if (episode) {
            break;
          }
        }
      }

      /*
       * ============================================
       * TOTAL EPISODE
       * ============================================
       */

      let totalEpisodes:
        | number
        | undefined;

      const pageText =
        document.body?.innerText || "";

      const totalPatterns = [
        /Episode\s+\d+\s*\/\s*(\d+)/i,
        /\b\d+\s*\/\s*(\d+)\b/,
        /(\d+)\s+Episodes?/i,
        /(\d+)\s+Episode/i,
      ];

      for (const pattern of totalPatterns) {
        const match =
          pageText.match(pattern);

        if (match) {
          const parsed =
            Number(match[1]);

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
       * Coba data attribute juga.
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
          const parsed =
            Number(value);

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
       * Jika hanya membuka detail, jangan menimpa
       * episode terakhir yang sudah ditonton.
       */

      const currentItems =
        useWatchHistoryStore.getState()
          .items;

      const historyId =
        `${platform.toLowerCase()}:${dramaId}`;

      const existing =
        currentItems.find((item) => {
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
       * Kalau hanya membuka detail dan history
       * sudah ada, jangan mengubah episode terakhir.
       */
      if (
        mode === "detail" &&
        existing
      ) {
        return;
      }

      /*
       * ============================================
       * SIMPAN HISTORY
       * ============================================
       *
       * Watch page akan menyimpan episode aktif.
       * Detail page tetap bisa membuat history
       * pertama kali jika belum ada.
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

    return () =>
      clearTimeout(timer);
  }, [pathname, addItem]);

  /*
   * Header memang disembunyikan di halaman watch.
   *
   * Effect di atas tetap berjalan karena hooks
   * dieksekusi sebelum return ini.
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
                  setSearchQuery(
                    e.target.value
                  )
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
