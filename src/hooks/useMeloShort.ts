import { useQuery } from "@tanstack/react-query";

export function useMeloShortDramas() {
  return useQuery({
    queryKey: ["meloshort-dramas"],
    queryFn: async () => {
      const res = await fetch("/api/meloshort?category_p=meloshort&lang=id");
      if (!res.ok) throw new Error("Gagal mengambil data MeloShort");
      const json = await res.json();
      
      return (json.data || []).map((item: any) => ({
        id: String(item.id || item.bookId || item.book_id || item.quickplay_id || ''),
        title: item.title || item.name || item.bookName || 'Untitled',
        cover: item.cover || item.image || item.coverWap || '',
        description: item.description || item.introduction || item.desc || '',
        tags: item.tags || item.tagNames || item.book_theme || [],
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}
