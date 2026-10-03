import { useQuery } from "@tanstack/react-query";

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

/**
 * Mengambil teks Indonesia dari object/string multilingual.
 *
 * QuickPlay/MeloShort bisa mengirim data dengan nama field yang
 * berbeda-beda tergantung endpoint/versi API.
 */
function pickIndonesianText(
  item: any,
  fields: string[],
  fallbackFields: string[] = []
): string {
  // 1. Prioritaskan field yang secara eksplisit mengandung ID/Indonesia.
  const indonesiaKeys = [
    ...fields.map((key) => `${key}_id`),
    ...fields.map((key) => `${key}Id`),
    ...fields.map((key) => `${key}_ID`),
    ...fields.map((key) => `${key}_indonesia`),
    ...fields.map((key) => `${key}Indonesia`),
    ...fields.map((key) => `${key}_id_id`),
  ];

  for (const key of indonesiaKeys) {
    const value = cleanText(item?.[key]);
    if (value) return value;
  }

  // 2. Kalau field-nya object multilingual:
  //    { id: "...", en: "...", ar: "..." }
  for (const key of fields) {
    const value = item?.[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const idValue =
        value.id ??
        value.ID ??
        value.id_ID ??
        value["id-ID"] ??
        value.ind ??
        value.indonesia ??
        value.Indonesia;

      const text = cleanText(idValue);
      if (text) return text;
    }
  }

  // 3. Beberapa API menggunakan array translations.
  for (const key of fields) {
    const value = item?.[key];

    if (Array.isArray(value)) {
      for (const translation of value) {
        if (!translation || typeof translation !== "object") continue;

        const language = String(
          translation.language ??
            translation.languageCode ??
            translation.lang ??
            translation.locale ??
            ""
        ).toLowerCase();

        if (
          language === "id" ||
          language === "ind" ||
          language === "indonesia" ||
          language === "id-id" ||
          language === "ind-id"
        ) {
          const text = cleanText(
            translation.text ??
              translation.value ??
              translation.title ??
              translation.name ??
              translation.content
          );

          if (text) return text;
        }
      }
    }
  }

  // 4. Field utama.
  for (const key of fields) {
    const text = cleanText(item?.[key]);
    if (text) return text;
  }

  // 5. Fallback terakhir.
  for (const key of fallbackFields) {
    const text = cleanText(item?.[key]);
    if (text) return text;
  }

  return "";
}

function pickCover(item: any): string {
  return (
    cleanText(item?.coverWap) ||
    cleanText(item?.cover) ||
    cleanText(item?.cover_url) ||
    cleanText(item?.coverUrl) ||
    cleanText(item?.book_pic) ||
    cleanText(item?.bookPic) ||
    cleanText(item?.cover_pic) ||
    cleanText(item?.image) ||
    cleanText(item?.imageUrl) ||
    ""
  );
}

function pickTags(item: any): string[] {
  const source =
    item?.tags ??
    item?.tagNames ??
    item?.book_theme ??
    item?.bookTheme ??
    item?.themes ??
    [];

  if (!Array.isArray(source)) return [];

  return source
    .map((tag: any) => {
      if (typeof tag === "string") return tag.trim();

      return (
        cleanText(tag?.tagName) ||
        cleanText(tag?.name) ||
        cleanText(tag?.title) ||
        cleanText(tag?.value)
      );
    })
    .filter(Boolean);
}

export function useMeloShortDramas() {
  return useQuery({
    queryKey: ["meloshort-dramas", "id"],

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
        throw new Error(
          `Respons MeloShort bukan JSON (HTTP ${res.status})`
        );
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

      /*
       * Beberapa kemungkinan struktur response:
       *
       * data: [...]
       * data: { list: [...] }
       * data: { dramas: [...] }
       * data: { books: [...] }
       */
      const rawData = json?.data;

      let list: any[] = [];

      if (Array.isArray(rawData)) {
        list = rawData;
      } else if (rawData && typeof rawData === "object") {
        const candidates = [
          rawData.list,
          rawData.dramas,
          rawData.books,
          rawData.items,
          rawData.records,
          rawData.data,
        ];

        const found = candidates.find(Array.isArray);

        if (found) {
          list = found;
        }
      }

      return list
        .map((item: any) => {
          const bookId = String(
            item?.bookId ??
              item?.book_id ??
              item?.id ??
              item?.quickplay_id ??
              item?.quickplayId ??
              ""
          ).trim();

          /*
           * PENTING:
           * Jangan langsung menganggap item.title/item.bookName
           * sebagai judul Indonesia.
           *
           * Kita prioritaskan semua kemungkinan field Indonesia
           * terlebih dahulu.
           */
          const bookName =
            pickIndonesianText(
              item,
              [
                "bookName",
                "book_name",
                "title",
                "name",
                "bookTitle",
                "book_title",
              ],
              [
                "displayName",
                "display_name",
              ]
            ) || "Untitled";

          const introduction =
            pickIndonesianText(
              item,
              [
                "introduction",
                "synopsis",
                "description",
                "desc",
                "summary",
                "bookIntroduction",
                "book_introduction",
                "bookSynopsis",
                "book_synopsis",
              ]
            ) || "";

          const cover = pickCover(item);

          const chapterCount = Number(
            item?.chapterCount ??
              item?.chapter_count ??
              item?.chapters ??
              item?.total_episodes ??
              item?.totalEpisodes ??
              item?.episodeCount ??
              item?.episode_count ??
              0
          );

          const tags = pickTags(item);

          return {
            id: bookId,
            bookId,

            // Judul yang akan digunakan DramaCard.
            title: bookName,
            bookName,

            cover,
            image: cover,

            description: introduction,
            introduction,

            tags,

            author:
              cleanText(item?.author) ||
              cleanText(item?.writer) ||
              "",

            status:
              cleanText(item?.status) ||
              cleanText(item?.bookStatus) ||
              "",

            views:
              item?.views ??
              item?.viewCount ??
              item?.view_count ??
              "",

            chapters: chapterCount,
            chapterCount,

            inLibrary: Boolean(item?.inLibrary ?? false),

            // Simpan data asli kalau nanti diperlukan.
            _raw: item,
          };
        })
        .filter(
          (item: any) =>
            Boolean(item.bookId) &&
            Boolean(item.bookName) &&
            item.bookName !== "Untitled"
        );
    },

    staleTime: 1000 * 60 * 5,

    retry: 2,
  });
}
