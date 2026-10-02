import { useQuery } from "@tanstack/react-query";

// ==========================================
// HOOK MELOSHORT (QUICKPLAY) - TERPISAH
// ==========================================
export function useMeloShortDramas() {
  return useQuery({
    queryKey: ["meloshort-dramas"],
    queryFn: async () => {
      // Menembak proxy universal yang diteruskan ke peladen Quickplay dengan HMAC-SHA256
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
