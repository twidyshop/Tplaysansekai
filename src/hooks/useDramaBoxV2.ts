"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Drama } from "@/types/drama";

function items(value: any, depth = 0): any[] {
  if (depth > 8 || value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "object") return [];
  for (const key of ["data", "list", "items", "results", "books", "dramas", "records", "theaterList", "recommendList"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  for (const key of Object.keys(value)) {
    const found = items(value[key], depth + 1);
    if (found.length) return found;
  }
  return [];
}
function pick(value: any, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const v = value?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return fallback;
}
function mapDrama(x: any): Drama {
  const id = pick(x, ["bookId", "book_id", "id", "dramaId", "shortPlayId", "seriesId"]);
  const cover = pick(x, ["cover", "coverUrl", "coverWap", "cover_url", "poster", "image", "thumbUrl", "verticalCover"]);
  return {
    bookId: id,
    bookName: pick(x, ["bookName", "title", "name", "dramaName"], "Untitled"),
    cover,
    coverWap: cover,
    chapterCount: Number(x?.chapterCount ?? x?.episodeCount ?? x?.totalEpisodes ?? x?.episodes ?? 0) || 0,
    introduction: pick(x, ["introduction", "description", "synopsis", "desc", "summary"]),
    tags: Array.isArray(x?.tags) ? x.tags.map((t: any) => typeof t === "string" ? t : t?.name || t?.tagName || "").filter(Boolean) : [],
    inLibrary: false,
  };
}
async function request(action: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ action, lang: "id", ...params });
  const response = await fetch("/api/dramaboxv2?" + q.toString(), { cache: "no-store" });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || "Gagal memuat DramaBox V2.");
  return json;
}
export function useDramaBoxV2Home() {
  const query = useInfiniteQuery({
    queryKey: ["dramaboxv2", "home"],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const data = await request("trending", { page: String(pageParam) });
      const dramas = items(data).map(mapDrama).filter(x => x.bookId && x.bookName !== "Untitled");
      return { dramas, page: pageParam };
    },
    getNextPageParam: (last, all) => {
      if (!last.dramas.length) return undefined;
      const seen = new Set(all.slice(0, -1).flatMap(p => p.dramas.map(d => d.bookId)));
      return last.dramas.some(d => !seen.has(d.bookId)) ? last.page + 1 : undefined;
    },
    staleTime: 300000,
    retry: 1,
  });
  const seen = new Set<string>();
  const dramas = query.data?.pages.flatMap(p => p.dramas.filter(d => !seen.has(d.bookId) && !!seen.add(d.bookId)));
  return { ...query, data: dramas };
}
export function useDramaBoxV2Detail(id: string) {
  return useQuery({ queryKey: ["dramaboxv2", "detail", id], enabled: !!id, queryFn: () => request("detail", { id }), staleTime: 300000, retry: 1 });
}
export function useDramaBoxV2Episodes(id: string) {
  return useQuery({ queryKey: ["dramaboxv2", "episodes", id], enabled: !!id, queryFn: () => request("episodes", { id }), staleTime: 300000, retry: 1 });
}
export async function getDramaBoxV2Play(id: string, ep: number) {
  return request("play", { id, ep: String(ep) });
}
export function extractDramaBoxV2Items(value: any): any[] { return items(value); }
export function extractDramaBoxV2Text(value: any, keys: string[], fallback = ""): string {
  if (!value || typeof value !== "object") return fallback;
  const direct = pick(value, keys);
  if (direct) return direct;
  for (const key of Object.keys(value)) {
    const found = extractDramaBoxV2Text(value[key], keys, "");
    if (found) return found;
  }
  return fallback;
}
