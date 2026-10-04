"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetcher";

function ex(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object") return [];

  for (const key of [
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
    const nested = ex(v[key]);
    if (nested.length) return nested;
  }

  return [];
}

export function useDramaNovaSearch(q: string) {
  const query = q.trim();

  return useQuery({
    queryKey: ["dramanova", "search", query],
    queryFn: async () =>
      ex(
        await fetchJson<any>(
          "/api/dramanova?action=search&q=" +
            encodeURIComponent(query) +
            "&lang=id"
        )
      ),
    enabled: !!query,
    staleTime: 120000,
  });
}

export function useDramaNovaHome() {
  return useQuery({
    queryKey: ["dramanova", "home"],
    queryFn: async () =>
      ex(await fetchJson<any>("/api/dramanova?action=trending&lang=id")),
    staleTime: 600000,
  });
}

export function useDramaNovaTrending() {
  return useQuery({
    queryKey: ["dramanova", "trending"],
    queryFn: async () =>
      ex(await fetchJson<any>("/api/dramanova?action=trending&lang=id")),
    staleTime: 600000,
  });
}

export function useDramaNovaForYou(page = 1) {
  return useQuery({
    queryKey: ["dramanova", "foryou", page],
    queryFn: async () =>
      ex(
        await fetchJson<any>(
          `/api/dramanova?action=foryou&page=${page}&lang=id`
        )
      ),
    staleTime: 600000,
  });
}

export function useDramaNovaLatest() {
  return useQuery({
    queryKey: ["dramanova", "latest"],
    queryFn: async () =>
      ex(await fetchJson<any>("/api/dramanova?action=latest&lang=id")),
    staleTime: 600000,
  });
}

export function useDramaNovaLanguages() {
  return useQuery({
    queryKey: ["dramanova", "languages"],
    queryFn: async () =>
      fetchJson<any>("/api/dramanova?action=languages"),
    staleTime: 86400000,
  });
}

export function useDramaNovaDetail(id: string) {
  return useQuery({
    queryKey: ["dramanova", "detail", id],
    queryFn: () =>
      fetchJson<any>(
        "/api/dramanova?action=detail&id=" +
          encodeURIComponent(id) +
          "&lang=id"
      ),
    enabled: !!id,
    staleTime: 600000,
  });
}

export function useDramaNovaPlay(id: string, ep: number) {
  return useQuery({
    queryKey: ["dramanova", "play", id, ep],
    queryFn: () =>
      fetchJson<any>(
        "/api/dramanova?action=play&id=" +
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
