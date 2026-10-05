"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetcher";

function ex(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object") return [];

  for (const k of [
    "data",
    "list",
    "rows",
    "results",
    "items",
    "dramas",
    "albums",
    "records",
    "contents",
  ]) {
    const n = ex(v[k]);
    if (n.length) return n;
  }

  return [];
}

export function useMoboReelsSearch(q: string) {
  const s = q.trim();

  return useQuery({
    queryKey: ["moboreels", "search", s],
    queryFn: async () =>
      ex(
        await fetchJson<any>(
          "/api/moboreels?action=search&query=" +
            encodeURIComponent(s) +
            "&lang=id"
        )
      ),
    enabled: !!s,
    staleTime: 120000,
  });
}

export function useMoboReelsHome() {
  return useQuery({
    queryKey: ["moboreels", "home"],
    queryFn: async () =>
      ex(await fetchJson<any>("/api/moboreels?action=home&lang=id")),
    staleTime: 600000,
  });
}

export function useMoboReelsForYou(page: number) {
  return useQuery({
    queryKey: ["moboreels", "foryou", page],
    queryFn: async () =>
      ex(
        await fetchJson<any>(
          "/api/moboreels?action=foryou&page=" + page + "&lang=id"
        )
      ),
    staleTime: 600000,
    placeholderData: (previous) => previous,
  });
}



export function useMoboReelsEpisodes(id: string) {
  return useQuery({
    queryKey: ["moboreels", "episodes", id],
    queryFn: () =>
      fetchJson<any>(
        "/api/moboreels?action=detail&id=" +
          encodeURIComponent(id) +
          "&lang=id"
      ),
    enabled: !!id,
    staleTime: 600000,
  });
}
export function useMoboReelsDetail(id: string) {
  return useQuery({
    queryKey: ["moboreels", "detail", id],
    queryFn: () =>
      fetchJson<any>(
        "/api/moboreels?action=detail&id=" +
          encodeURIComponent(id) +
          "&lang=id"
      ),
    enabled: !!id,
    staleTime: 600000,
  });
}

export function useMoboReelsPlay(id: string, ep: number) {
  return useQuery({
    queryKey: ["moboreels", "play", id, ep],
    queryFn: () =>
      fetchJson<any>(
        "/api/moboreels?action=play&id=" +
          encodeURIComponent(id) +
          "&ep=" +
          ep +
          "&lang=id"
      ),
    enabled: !!id && ep > 0,
    staleTime: 60000,
    retry: 0,
  });
}
