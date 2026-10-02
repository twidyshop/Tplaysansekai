import { useQuery } from "@tanstack/react-query";

export function useMeloShortDramas() {
  return useQuery({
    queryKey: ["meloshort-dramas"],
    queryFn: async () => {
      const params = new URLSearchParams({
        path: "/api/v2/home",
        category_p: "meloshort",
        lang: "id",
      });

      const res = await fetch(`/api/meloshort?${params.toString()}`, {
        cache: "no-store",
      });

      const raw = await res.text();

      let json: any;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Respons MeloShort bukan JSON (HTTP ${res.status})`);
      }

      if (!res.ok || json?.success === false) {
        throw new Error(
          `MeloShort: ${
            json?.error ||
            json?.message ||
            `HTTP ${res.status} dari QuickPlay API`
          }`
        );
      }

      const list = Array.isArray(json?.data) ? json.data : [];

      return list
        .map((item: any) => {
          const bookId = String(
            item.bookId ??
              item.book_id ??
              item.id ??
              item.quickplay_id ??
              item.quickplayId ??
              ""
          );

          const bookName =
            item.bookName ??
            item.book_name ??
            item.title ??
            item.name ??
            "Untitled";

          const introduction =
            item.introduction ??
            item.synopsis ??
            item.description ??
            item.desc ??
            "";

          const cover =
            item.cover ??
            item.coverWap ??
            item.cover_url ??
            item.image ??
            "";

          const chapterCount = Number(
            item.chapterCount ??
              item.chapter_count ??
              item.chapters ??
              item.total_episodes ??
              item.totalEpisodes ??
              0
          );

          const tags = Array.isArray(item.tags)
            ? item.tags
            : Array.isArray(item.tagNames)
            ? item.tagNames
            : Array.isArray(item.book_theme)
            ? item.book_theme
            : [];

          // Bentuk object sengaja disamakan dengan Drama[] yang dipakai
          // oleh DramaSection agar TypeScript tidak gagal build.
          return {
            id: bookId,
            bookId,
            title: bookName,
            bookName,
            cover,
            image: cover,
            description: introduction,
            introduction,
            tags,
            author: item.author ?? "",
            status: item.status ?? "",
            views: item.views ?? "",
            chapters: chapterCount,
            chapterCount,
            inLibrary: Boolean(item.inLibrary ?? false),
          };
        })
        .filter((item: any) => item.bookId && item.bookName);
    },
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
}
