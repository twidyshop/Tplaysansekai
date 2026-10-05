"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";

function arr(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object") return [];
  for (const k of ["data", "list", "rows", "results", "items", "books", "dramas", "albums"]) {
    if (Array.isArray(v[k])) return v[k];
    const n = arr(v[k]);
    if (n.length) return n;
  }
  return [];
}

function deepPick(v: any, keys: string[], fallback = "", depth = 0): string {
  if (depth > 8 || v == null) return fallback;
  const direct = pick(v, keys, "");
  if (direct) return direct;
  if (typeof v !== "object") return fallback;
  for (const k of Object.keys(v)) {
    const found = deepPick(v[k], keys, "", depth + 1);
    if (found) return found;
  }
  return fallback;
}

function pick(v: any, keys: string[], fallback = "") {
  for (const k of keys) {
    const x = v?.[k];
    if (typeof x === "string" && x.trim()) return x.trim();
    if (typeof x === "number") return String(x);
  }
  return fallback;
}

function getIqiyiTagOptions(value: any, kind: "region" | "genre" | "sort"): { value: string; label: string }[] {
  const data = value?.data ?? value ?? {};

  if (kind === "sort") {
    const sort = Array.isArray(data?.sort) ? data.sort : [];
    return sort
      .filter((item: any) => item?.id != null && item?.name)
      .map((item: any) => ({ value: String(item.id), label: String(item.name) }));
  }

  const filterType = kind === "region" ? "area" : "type";
  const group = Array.isArray(data?.filter)
    ? data.filter.find((item: any) => item?.type === filterType)
    : null;

  return Array.isArray(group?.child)
    ? group.child
        .filter((item: any) => item?.id != null && item?.name)
        .map((item: any) => ({ value: String(item.id), label: String(item.name) }))
    : [];
}

function mapItem(x: any, i: number) {
  const id = pick(x, ["id", "bookId", "dramaId", "videoId", "albumId"], String(i));
  const albumId = pick(x, ["albumId", "album_id", "albumID"], "");
  return {
    id,
    albumId,
    title: pick(x, ["title", "name", "bookName", "albumName"], "Untitled"),
    cover: pick(x, ["cover", "poster", "image", "thumbnail", "coverUrl", "pic", "albumPic"], ""),
    description: deepPick(x, ["description", "synopsis", "introduction", "intro", "desc", "summary", "shotDesc", "storyline", "plot", "content", "brief", "briefIntroduction", "shortDescription", "longDescription", "descriptionText", "descText", "synopsisText", "summaryText", "story", "storylineText", "contentDesc", "contentDescription"], ""),
    episodes: Number(x?.episodes ?? x?.episodeCount ?? x?.totalEpisodes ?? x?.chapterCount ?? 0),
  };
}

function Section({
  title,
  data,
  loading,
  onMore,
  hasMore,
}: {
  title: string;
  data: any[];
  loading: boolean;
  onMore?: () => void;
  hasMore?: boolean;
}) {
  const items = data.map(mapItem);
  if (!items.length && !loading) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {hasMore && onMore && (
          <button
            onClick={onMore}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Memuat..." : "Muat lebih banyak"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
        {items.map((x, i) => {
          const imageSrc = x.cover
            ? "/api/iqiyi/image?url=" + encodeURIComponent(x.cover)
            : "";
          return (
          <Link
            key={x.id + "-" + i}
            href={
              "/detail/iqiyi/" +
              encodeURIComponent(x.id) +
              "?title=" +
              encodeURIComponent(x.title) +
              "&cover=" +
              encodeURIComponent(x.cover) +
              (x.albumId ? "&albumId=" + encodeURIComponent(x.albumId) : "") +
              (x.description ? "&description=" + encodeURIComponent(x.description) : "") +
              (x.episodes ? "&episodes=" + x.episodes : "")
            }
            className="group min-w-0"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/5 bg-zinc-900">
              {x.cover ? (
                <img
                  src={imageSrc}
                  alt={x.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    const img = event.currentTarget;
                    if (img.dataset.fallback === "1") {
                      img.style.display = "none";
                      return;
                    }
                    img.dataset.fallback = "1";
                    img.src =
                      "https://wsrv.nl/?url=" +
                      encodeURIComponent(x.cover) +
                      "&output=jpg&q=88&w=1200";
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">
                  No Image
                </div>
              )}
              {x.episodes > 0 && (
                <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold">
                  {x.episodes} EP
                </span>
              )}
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/90">
              {x.title}
            </h3>
          </Link>
          );
        })}
      </div>
    </section>
  );
}

async function get(url: string) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Request gagal");
  return j;
}

const SNAPSHOT_KEY = "tplay-iqiyi-trending-id-v2";

export function IqiyiHome() {
  const [snapshot, setSnapshot] = useState<any[]>([]);
  const [region,setRegion]=useState("");
  const [genre,setGenre]=useState("");
  const [sort,setSort]=useState("");
  const tags=useQuery({queryKey:["iqiyi-tags-id"],queryFn:()=>get("/api/iqiyi?action=tags&cid=4&lang=id"),staleTime:1800000,gcTime:3600000,retry:0});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSnapshot(parsed);
      }
    } catch {}
  }, []);

  const trending = useQuery({
    queryKey: ["iqiyi-trending-id"],
    queryFn: () => get("/api/iqiyi?action=home&lang=id"),
    staleTime: 600000,
    gcTime: 1800000,
  });

  useEffect(() => {
    const items = arr(trending.data);
    if (!items.length) return;
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(items.slice(0, 24)));
    } catch {}
  }, [trending.data]);

  const tagParams=new URLSearchParams({lang:"id"});
  if(region) tagParams.set("region",region);
  if(genre) tagParams.set("genre",genre);
  if(sort) tagParams.set("sort",sort);

  const drama = useInfiniteQuery({
    queryKey: ["iqiyi-drama-id",region,genre,sort],
    queryFn: ({ pageParam }) => get("/api/iqiyi?action=drama&page="+pageParam+"&"+tagParams.toString()),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (arr(last).length ? pages.length + 1 : undefined),
    staleTime: 600000,
  });

  const anime = useInfiniteQuery({
    queryKey: ["iqiyi-anime-id",region,genre,sort],
    queryFn: ({ pageParam }) => get("/api/iqiyi?action=anime&page="+pageParam+"&"+tagParams.toString()),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (arr(last).length ? pages.length + 1 : undefined),
    staleTime: 600000,
  });

  const kdrama = useInfiniteQuery({
    queryKey: ["iqiyi-kdrama-id",region,genre,sort],
    queryFn: ({ pageParam }) => get("/api/iqiyi?action=kdrama&page="+pageParam+"&"+tagParams.toString()),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (arr(last).length ? pages.length + 1 : undefined),
    staleTime: 600000,
  });

  const movie = useInfiniteQuery({
    queryKey: ["iqiyi-movie-id",region,genre,sort],
    queryFn: ({ pageParam }) => get("/api/iqiyi?action=movie&page="+pageParam+"&"+tagParams.toString()),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (arr(last).length ? pages.length + 1 : undefined),
    staleTime: 600000,
  });

  const variety = useInfiniteQuery({
    queryKey: ["iqiyi-variety-id",region,genre,sort],
    queryFn: ({ pageParam }) => get("/api/iqiyi?action=variety&page="+pageParam+"&"+tagParams.toString()),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (arr(last).length ? pages.length + 1 : undefined),
    staleTime: 600000,
  });

  const foryou = useQuery({
    queryKey: ["iqiyi-foryou-id"],
    queryFn: () => get("/api/iqiyi?action=foryou&lang=id"),
    staleTime: 600000,
    gcTime: 1800000,
    retry: 0,
  });

  const liveTrendingItems = arr(trending.data);
  const trendingItems = liveTrendingItems.length ? liveTrendingItems : snapshot;
  const dramaItems = drama.data?.pages.flatMap(arr) ?? [];
  const animeItems = anime.data?.pages.flatMap(arr) ?? [];
  const kdramaItems = kdrama.data?.pages.flatMap(arr) ?? [];
  const movieItems = movie.data?.pages.flatMap(arr) ?? [];
  const varietyItems = variety.data?.pages.flatMap(arr) ?? [];
  const foryouItems = arr(foryou.data);
  const regionTags=getIqiyiTagOptions(tags.data,"region");
  const genreTags=getIqiyiTagOptions(tags.data,"genre");
  const sortTags=getIqiyiTagOptions(tags.data,"sort");

  if (!trendingItems.length && trending.isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (trending.error && !trendingItems.length) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
        Gagal memuat iQIYI. Pastikan HOSHIYOMI_API_KEY sudah diisi dan plan Hoshiyomi mendukung iQIYI.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {(regionTags.length||genreTags.length||sortTags.length)>0&&<section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-white">Filter iQIYI</h2>{(region||genre||sort)&&<button onClick={()=>{setRegion("");setGenre("");setSort("");}} className="text-xs text-white/50 hover:text-white">Reset</button>}</div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{regionTags.length>0&&<select value={region} onChange={e=>setRegion(e.target.value)} className="rounded-xl border border-white/10 bg-[#111735] px-3 py-2.5 text-sm text-white"><option value="">Semua Region</option>{regionTags.map(x=><option key={"r-"+x.value} value={x.value}>{x.label}</option>)}</select>}{genreTags.length>0&&<select value={genre} onChange={e=>setGenre(e.target.value)} className="rounded-xl border border-white/10 bg-[#111735] px-3 py-2.5 text-sm text-white"><option value="">Semua Genre</option>{genreTags.map(x=><option key={"g-"+x.value} value={x.value}>{x.label}</option>)}</select>}{sortTags.length>0&&<select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border border-white/10 bg-[#111735] px-3 py-2.5 text-sm text-white"><option value="">Urutan Default</option>{sortTags.map(x=><option key={"s-"+x.value} value={x.value}>{x.label}</option>)}</select>}</div></section>}

      <Section title="Trending" data={trendingItems} loading={false} />
      <Section
        title="Drama"
        data={dramaItems}
        loading={drama.isFetchingNextPage}
        onMore={() => drama.fetchNextPage()}
        hasMore={!!drama.hasNextPage}
      />
      <Section
        title="Untukmu"
        data={foryouItems}
        loading={foryou.isLoading}
      />
      <Section
        title="Drama"
        data={dramaItems}
        loading={drama.isLoading || drama.isFetchingNextPage}
        onMore={() => drama.fetchNextPage()}
        hasMore={!!drama.hasNextPage}
      />
      <Section
        title="K-Drama"
        data={kdramaItems}
        loading={kdrama.isLoading || kdrama.isFetchingNextPage}
        onMore={() => kdrama.fetchNextPage()}
        hasMore={!!kdrama.hasNextPage}
      />
      <Section
        title="Movie"
        data={movieItems}
        loading={movie.isLoading || movie.isFetchingNextPage}
        onMore={() => movie.fetchNextPage()}
        hasMore={!!movie.hasNextPage}
      />
      <Section
        title="Anime"
        data={animeItems}
        loading={anime.isLoading || anime.isFetchingNextPage}
        onMore={() => anime.fetchNextPage()}
        hasMore={!!anime.hasNextPage}
      />
      <Section
        title="Variety"
        data={varietyItems}
        loading={variety.isLoading || variety.isFetchingNextPage}
        onMore={() => variety.fetchNextPage()}
        hasMore={!!variety.hasNextPage}
      />
    </div>
  );
}
