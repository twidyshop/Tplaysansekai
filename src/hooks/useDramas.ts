import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { Drama, SearchResult } from "@/types/drama";

const API_BASE = "/api/dramabox";

import { fetchJson } from "@/lib/fetcher";

const REC_API_BASE = "/api/reelshort";

// Infinite Scroll Hook for DramaBox "Lainnya"
export function useInfiniteForYouDramas() {
  return useInfiniteQuery({
    queryKey: ["dramas", "foryou", "infinite"],
    queryFn: ({ pageParam = 1 }) => fetchJson<Drama[]>(`${API_BASE}/foryou?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (lastPage: Drama[], allPages: Drama[][]) => {
        if (!lastPage || lastPage.length === 0 || allPages.length >= 100) return undefined;
        return allPages.length + 1;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Infinite Scroll Hook for ReelShort "Lainnya"
export function useInfiniteReelShortDramas() {
  return useInfiniteQuery({
    queryKey: ["reels", "foryou", "infinite"],
    queryFn: ({ pageParam = 1 }) => fetchJson<Drama[]>(`${REC_API_BASE}/foryou?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (lastPage: Drama[], allPages: Drama[][]) => {
        if (!lastPage || lastPage.length === 0 || allPages.length >= 100) return undefined;
        return allPages.length + 1;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useForYouDramas() {
  return useQuery({
    queryKey: ["dramas", "foryou"],
    queryFn: () => fetchJson<Drama[]>(`${API_BASE}/foryou`),
    staleTime: 1000 * 60 * 5,
  });
}

export function useLatestDramas() {
  return useQuery({
    queryKey: ["dramas", "latest"],
    queryFn: () => fetchJson<Drama[]>(`${API_BASE}/latest`),
    staleTime: 1000 * 60 * 5,
  });
}

export function useTrendingDramas() {
  return useQuery({
    queryKey: ["dramas", "trending"],
    queryFn: () => fetchJson<Drama[]>(`${API_BASE}/trending`),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSearchDramas(query: string) {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: ["dramas", "search", normalizedQuery],
    queryFn: async () => {
         if (!normalizedQuery) return [];
         return fetchJson<SearchResult[]>(`${API_BASE}/search?query=${encodeURIComponent(normalizedQuery)}`);
    },
    enabled: normalizedQuery.length > 0,
    staleTime: 1000 * 60 * 2,
  });
}

export function useDubindoDramas() {
  return useQuery({
    queryKey: ["dramas", "dubindo"],
    queryFn: () => fetchJson<Drama[]>(`${API_BASE}/dubindo`),
    staleTime: 1000 * 60 * 5,
  });
}

// ==========================================
// HOOK MELOSHORT (QUICKPLAY) - SUDAH DISESUAIKAN KE PROXY CATCH-ALL
// ==========================================
export function useMeloShortDramas() {
  return useQuery({
    queryKey: ["meloshort-dramas"],
    queryFn: async () => {
      // PERHATIKAN DI SINI: Menembak proxy universal ke endpoint v2/home dengan bahasa Indonesia
      const res = await fetch("/api/meloshort/proxy?path=/api/v2/home&lang=id");
      if (!res.ok) throw new Error("Gagal mengambil data MeloShort");
      const json = await res.json();
      
      // Mapping data agar aman dan langsung tampil di UI TPLAY+
      return (json.data || []).map((item: any) => ({
        id: String(item.id || item.bookId || item.quickplay_id || ''),
        title: item.title || item.name || item.bookName || 'Untitled',
        cover: item.cover || item.image || item.coverWap || '',
        description: item.description || item.introduction || item.desc || '',
        tags: item.tags || item.tagNames || item.book_theme || [],
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}
