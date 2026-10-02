import { useQuery } from "@tanstack/react-query";

export interface MeloShortDrama {
  id: string;
  title: string;
  cover: string;
  description: string;
  tags?: string[];
}

export function useMeloShortDramas() {
  return useQuery({
    queryKey: ["meloshort-dramas"],
    queryFn: async () => {
      // Sesuaikan endpoint API Quickplay Anda di sini
      const res = await fetch("/api/meloshort/trending");
      if (!res.ok) throw new Error("Gagal mengambil data MeloShort");
      const json = await res.json();
      
      // Mapping data agar aman dan seragam
      return (json.data || []).map((item: any) => ({
        id: String(item.id || item.bookId || ''),
        title: item.title || item.name || 'Untitled',
        cover: item.cover || item.image || '',
        description: item.description || '',
        tags: item.tags || [],
      }));
    },
    staleTime: 1000 * 60 * 5, // Cache 5 menit
  });
}
