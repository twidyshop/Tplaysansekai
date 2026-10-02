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
      const res = await fetch("/api/meloshort/discover"); // Sesuaikan endpoint API Quickplay Anda
      if (!res.ok) throw new Error("Gagal mengambil data MeloShort");
      const json = await res.json();
      
      return (json.data || []).map((item: any) => ({
        id: String(item.id || item.bookId || ''),
        title: item.title || item.name || 'Untitled',
        cover: item.cover || item.image || '',
        description: item.description || '',
        tags: item.tags || [],
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}
