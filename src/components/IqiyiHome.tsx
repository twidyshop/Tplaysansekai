"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";

function firstArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["data", "list", "rows", "results", "items", "books", "dramas"]) {
    if (Array.isArray(value[key])) return value[key];
    const nested = firstArray(value[key]);
    if (nested.length) return nested;
  }
  return [];
}

function pick(value: any, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const current = value?.[key];
    if (typeof current === "string" && current.trim()) return current.trim();
    if (typeof current === "number") return String(current);
  }
  return fallback;
}

function mapDrama(item: any, index: number) {
  return {
    id: pick(item, ["id", "bookId", "albumId", "dramaId", "videoId"], String(index)),
    title: pick(item, ["title", "name", "bookName", "albumName"], "Untitled"),
    cover: pick(item, ["cover", "poster", "image", "thumbnail", "coverUrl", "pic"], ""),
    episodes: Number(item?.episodes ?? item?.episodeCount ?? item?.totalEpisodes ?? item?.chapterCount ?? 0),
  };
}

export function IqiyiHome() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["iqiyi-home"],
    queryFn: async () => {
      const response = await fetch("/api/iqiyi?action=home", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Gagal mengambil data IQIYI");
      return json;
    },
    staleTime: 1000 * 60 * 5,
  });

  const dramas = firstArray(data).map(mapDrama);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="aspect-[3/4] rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
        Gagal memuat IQIYI. Pastikan HOSHIYOMI_API_KEY sudah diisi di Vercel.
      </div>
    );
  }

  if (!dramas.length) {
    return <div className="py-16 text-center text-white/50">Belum ada drama IQIYI yang tersedia.</div>;
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">IQIYI</h2>
        <p className="mt-1 text-xs text-white/40">Drama pilihan dari iQIYI</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
        {dramas.map((drama, index) => (
          <Link
            key={String(drama.id) + "-" + index}
            href={"/detail/iqiyi/" + encodeURIComponent(drama.id)}
            className="group min-w-0"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900 border border-white/5">
              {drama.cover ? (
                <Image
                  src={drama.cover}
                  alt={drama.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">No Image</div>
              )}
              {drama.episodes > 0 && (
                <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                  {drama.episodes} EP
                </span>
              )}
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/90">{drama.title}</h3>
          </Link>
        ))}
      </div>
    </section>
  );
}
