"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  useMoboReelsForYou,
  useMoboReelsHome,
} from "@/hooks/useMoboReels";
import { UnifiedMediaCard } from "./UnifiedMediaCard";
import { UnifiedMediaCardSkeleton } from "./UnifiedMediaCardSkeleton";

function value(x: any, keys: string[], fallback = "") {
  for (const key of keys) {
    const v = x?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return fallback;
}

function mapDrama(x: any, index: number) {
  const id = value(
    x,
    ["id", "dramaId", "drama_id", "bookId", "videoId", "albumId", "key"],
    String(index)
  );
  const title = value(
    x,
    ["title", "name", "bookName", "book_name", "albumName", "dramaName"],
    "Untitled"
  );
  const cover = value(
    x,
    [
      "cover",
      "coverUrl",
      "cover_url",
      "poster",
      "posterUrl",
      "poster_url",
      "image",
      "imageUrl",
      "image_url",
      "thumbnail",
      "thumbUrl",
      "thumb_url",
      "pic",
      "picUrl",
      "pic_url",
    ],
    ""
  );

  const episodes = Number(
    value(
      x,
      ["totalEpisodes", "episodeCount", "episode_count", "serialCount", "serial_count"],
      "0"
    )
  ) || 0;

  return { id, title, cover, episodes };
}

function DramaGrid({ items }: { items: any[] }) {
  const mapped = useMemo(
    () => items.map((x, i) => mapDrama(x, i)).filter((x) => x.cover),
    [items]
  );

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
      {mapped.map((item, i) => (
        <UnifiedMediaCard
          key={item.id + "-" + i}
          index={i}
          title={item.title}
          cover={
            "/api/moboreels/image?url=" + encodeURIComponent(item.cover)
          }
          link={
            "/detail/moboreels/" +
            encodeURIComponent(item.id) +
            "?title=" +
            encodeURIComponent(item.title) +
            "&cover=" +
            encodeURIComponent(item.cover)
          }
          episodes={item.episodes}
        />
      ))}
    </div>
  );
}

export function MoboReelsHome() {
  const {
    data: trending,
    isLoading: trendingLoading,
    error: trendingError,
    refetch: refetchTrending,
  } = useMoboReelsHome();

  const [showMore, setShowMore] = useState(false);
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<any[]>([]);

  const {
    data: forYou,
    isLoading: forYouLoading,
    isFetching: forYouFetching,
    error: forYouError,
  } = useMoboReelsForYou(page);

  useEffect(() => {
    if (!forYou) return;
    setCatalog((previous) => {
      if (page === 1) return forYou;
      const seen = new Set(previous.map((item: any, index: number) => mapDrama(item, index).id));
      const next = forYou.filter((item: any, index: number) => {
        const id = mapDrama(item, index).id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      return [...previous, ...next];
    });
  }, [forYou, page]);

  const visibleTrending = (trending || []).slice(0, 12);

  if (trendingLoading) {
    return (
      <section>
        <h2 className="font-display font-bold text-xl md:text-2xl text-foreground mb-4">
          Trending
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <UnifiedMediaCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (trendingError) {
    return (
      <section>
        <h2 className="font-display font-bold text-xl md:text-2xl text-foreground mb-4">
          Trending
        </h2>
        <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-6 text-red-300">
          MoboReels gagal dimuat.
          <button onClick={() => refetchTrending()} className="underline ml-1">
            Coba lagi
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-display font-bold text-xl md:text-2xl text-foreground">
            Trending
          </h2>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {showMore ? "Sembunyikan" : "Lihat lebih banyak"}
            {showMore ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {visibleTrending.length === 0 ? (
          <div className="rounded-xl border border-white/10 p-6 text-white/60">
            Tidak ada data MoboReels.
          </div>
        ) : (
          <DramaGrid items={visibleTrending} />
        )}
      </div>

      {showMore && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-display font-bold text-xl md:text-2xl text-foreground">
              Semua Drama
            </h2>
            <span className="text-xs text-white/50">Halaman {page}</span>
          </div>

          {forYouLoading && !forYou ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <UnifiedMediaCardSkeleton key={i} />
              ))}
            </div>
          ) : forYouError ? (
            <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-6 text-red-300">
              Katalog MoboReels gagal dimuat.
            </div>
          ) : (
            <>
              <DramaGrid items={catalog} />

              <div className="pt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={forYouFetching || !(forYou && forYou.length)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {forYouFetching && <Loader2 className="w-4 h-4 animate-spin" />}
                  {forYouFetching ? "Memuat..." : "Muat lebih banyak"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
