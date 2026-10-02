import { useQuery } from "@tanstack/react-query";

type MeloShortDrama = {
  id: string;
  title: string;
  cover: string;
  description: string;
  tags: string[];
  author?: string;
  status?: string;
  views?: string | number;
  chapters?: number;
};

export function useMeloShortDramas() {
  return useQuery<MeloShortDrama[]>({
    queryKey: ["meloshort-dramas"],
    queryFn: async () => {
      // QuickPlay v2 /home requires category_p.
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
        throw new Error(
          `Respons MeloShort bukan JSON (HTTP ${res.status}).`
        );
      }

      if (!res.ok || json?.success === false) {
        const apiError =
          json?.error ||
          json?.message ||
          `HTTP ${res.status} dari QuickPlay API`;

        throw new Error(`MeloShort: ${apiError}`);
      }

      const list = Array.isArray(json?.data) ? json.data : [];

      return list
        .map((item: any): MeloShortDrama => ({
          id: String(
            item.id ??
              item.bookId ??
              item.book_id ??
              item.quickplay_id ??
              ""
          ),
          title:
            item.title ??
            item.name ??
            item.bookName ??
            "Untitled",
          cover:
            item.cover ??
            item.image ??
            item.coverWap ??
            item.cover_url ??
            "",
          description:
            item.synopsis ??
            item.description ??
            item.introduction ??
            item.desc ??
            "",
          tags: Array.isArray(item.tags)
            ? item.tags
            : Array.isArray(item.tagNames)
            ? item.tagNames
            : Array.isArray(item.book_theme)
            ? item.book_theme
            : [],
          author: item.author ?? "",
          status: item.status ?? "",
          views: item.views ?? "",
          chapters: Number(item.chapters ?? item.total_episodes ?? 0),
        }))
        .filter((item) => item.id && item.title);
    },
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
}
