"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useMoboReelsForYou, useMoboReelsHome } from "@/hooks/useMoboReels";
import { UnifiedMediaCard } from "./UnifiedMediaCard";
import { UnifiedMediaCardSkeleton } from "./UnifiedMediaCardSkeleton";

function value(x: any, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const v = x?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return fallback;
}

function deepString(x: any, keys: string[], depth = 0): string {
  if (depth > 7 || x == null) return "";
  const direct = value(x, keys, "");
  if (direct) return direct;
  if (typeof x !== "object") return "";
  for (const key of Object.keys(x)) {
    const found = deepString(x[key], keys, depth + 1);
    if (found) return found;
  }
  return "";
}

function normalizeImageUrl(url: string) {
  const s = url.trim();
  if (s.startsWith("//")) return "https:" + s;
  return s;
}

function mapDrama(x: any, index: number) {
  const id = deepString(
    x,
    ["id", "dramaId", "drama_id", "bookId", "videoId", "albumId", "key"],
  ) || String(index);

  const title =
    deepString(
      x,
      ["title", "name", "bookName", "book_name", "albumName", "dramaName"],
    ) || "Untitled";

  const cover = normalizeImageUrl(
    deepString(x, [
      "cover",
      "coverUrl",
      "cover_url",
      "coverImage",
      "cover_image",
      "coverImg",
      "verticalCover",
      "vertical_cover",
      "poster",
      "posterUrl",
      "poster_url",
      "posterImage",
      "poster_image",
      "image",
      "imageUrl",
      "image_url",
      "thumbnail",
      "thumbnailUrl",
      "thumbnail_url",
      "thumbUrl",
      "thumb_url",
      "pic",
      "picUrl",
      "pic_url",
      "img",
      "imgUrl",
      "img_url",
    ])
  );

  const episodes =
    Number(
      deepString(x, [
        "totalEpisodes",
        "episodeCount",
        "episode_count",
        "serialCount",
        "serial_count",
        "episodes",
      ])
    ) || 0;

  return { id, title, cover, episodes };
}

function DramaGrid({ items }: { items: any[] }) {
  const mapped = useMemo(
    () =>
      items
        .map((x, i) => mapDrama(x, i))
        .filter((x) => x.cover && x.id),
    [items]
  );

  if (!mapped.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/55">
        Data drama diterima, tetapi URL cover dari API belum bisa dibaca.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 md:gap-4">
      {mapped.map((item, i) => (
        <UnifiedMediaCard
          key={item.id + "-" + i}
          index={i}
          title={item.title}
          cover={"/api/moboreels/image?url=" + encodeURIComponent(item.cover)}
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
      const seen = new Set(
        previous.map((item: any, index: number) => mapDrama(item, index).id)
      );
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
  const trendingItems = showMore ? trending || [] : visibleTrending;

  if (trendingLoading || (forYouLoading && !forYou)) {
    return (
      <section>
        <h2 className="mb-4 text-xl font-bold md:text-2xl">MoboReels</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 md:gap-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <UnifiedMediaCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (trendingError) {
    return (
      <section>
        <h2 className="mb-4 text-xl font-bold md:text-2xl">MoboReels</h2>
        <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-6 text-red-300">
          MoboReels gagal dimuat.
          <button onClick={() => refetchTrending()} className="ml-1 underline">
            Coba lagi
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-10">
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold md:text-2xl">Trending</h2>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            {showMore ? "Sembunyikan" : "Lihat lebih banyak"}
            {showMore ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        <DramaGrid items={trendingItems} />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold md:text-2xl">For You</h2>
          <span className="text-xs text-white/45">Halaman {page}</span>
        </div>

        {forYouError ? (
          <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-6 text-sm text-red-300">
            For You gagal dimuat. Coba refresh halaman.
          </div>
        ) : (
          <>
            <DramaGrid items={catalog} />
            <div className="flex justify-center pt-5">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={forYouFetching || !(forYou && forYou.length)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {forYouFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                {forYouFetching ? "Memuat..." : "Muat lebih banyak"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
