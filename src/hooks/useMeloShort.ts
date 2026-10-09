import { useInfiniteQuery } from "@tanstack/react-query";

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Menentukan apakah sebuah judul merupakan judul Indonesia.
 *
 * MeloShort/QuickPlay dengan lang=id ternyata masih mengembalikan
 * campuran judul Indonesia, Inggris, dan Arab.
 *
 * Karena response tidak menyediakan languageCode per item,
 * kita filter berdasarkan karakter judul.
 */
function isIndonesianTitle(title: string): boolean {
  const text = cleanText(title);

  if (!text) return false;

  // Arab -> bukan Indonesia
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) {
    return false;
  }

  // CJK -> bukan Indonesia
  if (/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/.test(text)) {
    return false;
  }

  /*
   * Judul MeloShort berbahasa Indonesia umumnya menggunakan
   * karakter Latin dan mengandung kata-kata Indonesia.
   *
   * Kita beri prioritas tinggi untuk kata Indonesia umum.
   */
  const lower = text.toLowerCase();

  const indonesianWords = [
    "cinta",
    "dalam",
    "mencari",
    "ketika",
    "wajah",
    "suami",
    "istri",
    "menikah",
    "pernikahan",
    "sebelum",
    "setelah",
    "balas",
    "dendam",
    "si",
    "kecil",
    "sejati",
    "palsu",
    "palsu",
    "ternyata",
    "miliarder",
    "hati",
    "air mata",
    "cinta",
    "kasih",
    "keluarga",
    "rahasia",
    "takdir",
    "nasib",
    "pengantin",
    "anak",
    "ayah",
    "ibu",
    "bos",
    "presiden",
    "kehidupan",
    "hidup",
    "bahagia",
    "terjebak",
    "terlahir",
    "kembali",
    "pengganti",
    "jodoh",
    "cemburu",
    "cinta sejati",
    "cerita",
    "gadis",
    "wanita",
    "pria",
    "lelaki",
  ];

  if (indonesianWords.some((word) => lower.includes(word))) {
    return true;
  }

  /*
   * Kalau tidak mengandung kata Indonesia yang umum,
   * kita tetap menerima judul Latin yang punya karakter khas
   * bahasa Indonesia.
   *
   * Namun judul Inggris murni seperti:
   * "Solely Mine"
   * "Bound to the Reaper"
   * "The Mermaid Baby Worth Millions"
   * akan ditolak.
   */
  const englishWords = [
    "the",
    "a ",
    "an ",
    "and ",
    "or ",
    "to ",
    "by ",
    "with ",
    "of ",
    "mine",
    "worth",
    "million",
    "millions",
    "reaper",
    "dragon",
    "shadow",
    "duke",
    "baby",
    "mafia",
    "stepdad",
    "heiress",
    "impostor",
    "trapped",
    "wedding",
    "scheme",
    "solely",
    "blood",
    "holy",
    "nanny",
    "vampire",
    "bond",
    "deadly",
    "love",
    "revenge",
    "reborn",
    "broken",
    "heart",
    "tycoon",
    "daughter",
    "wife",
    "husband",
    "queen",
    "king",
    "secret",
  ];

  if (englishWords.some((word) => lower.includes(word))) {
    return false;
  }

  /*
   * Untuk keamanan, judul yang hanya terdiri dari huruf Latin
   * tetap boleh masuk jika bukan jelas-jelas Inggris/Arab.
   *
   * Ini menangani judul Indonesia yang tidak mengandung kata
   * dari daftar di atas.
   */
  return /^[A-Za-zÀ-ÿ0-9\s.,!?'"“”‘’:&()\-…]+$/.test(text);
}

function pickCover(item: any): string {
  return (
    cleanText(item?.cover) ||
    cleanText(item?.coverWap) ||
    cleanText(item?.cover_url) ||
    cleanText(item?.coverUrl) ||
    cleanText(item?.book_pic) ||
    cleanText(item?.bookPic) ||
    cleanText(item?.cover_pic) ||
    cleanText(item?.image) ||
    ""
  );
}

function pickTags(item: any): string[] {
  const source =
    item?.tags ??
    item?.genres ??
    item?.tagNames ??
    item?.book_theme ??
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
  const query = useInfiniteQuery({
    queryKey: ["meloshort-dramas", "id"],
    initialPageParam: 1,

    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        path: "/api/v2/home",
        category_p: "meloshort",
        lang: "id",
        page: String(pageParam),
        limit: "20",
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

      const list = Array.isArray(json?.data)
        ? json.data
        : [];

      /*
       * ==========================================================
       * FILTER BAHASA
       * ==========================================================
       *
       * API lang=id masih memberikan campuran bahasa.
       * Jadi kita hanya memasukkan judul yang terdeteksi
       * sebagai judul Indonesia/Latin non-Inggris.
       */
      const indonesianList = list.filter((item: any) => {
        const title = cleanText(
          item?.title ??
            item?.bookName ??
            item?.book_name ??
            item?.name ??
            ""
        );

        return isIndonesianTitle(title);
      });

      const dramas = indonesianList
        .map((item: any) => {
          const bookId = String(
            item?.id ??
              item?.bookId ??
              item?.book_id ??
              item?.quickplay_id ??
              item?.quickplayId ??
              ""
          ).trim();

          const bookName = cleanText(
            item?.title ??
              item?.bookName ??
              item?.book_name ??
              item?.name ??
              "Untitled"
          );

          const introduction = cleanText(
            item?.synopsis ??
              item?.introduction ??
              item?.description ??
              item?.desc ??
              item?.summary ??
              ""
          );

          const cover = pickCover(item);

          const chapterCount = Number(
            item?.chapters ??
              item?.chapterCount ??
              item?.chapter_count ??
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

            title: bookName,
            bookName,

            cover,
            image: cover,

            description: introduction,
            introduction,

            tags,

            author: cleanText(item?.author),

            status: cleanText(item?.status),

            views:
              item?.views ??
              item?.viewCount ??
              item?.view_count ??
              "",

            chapters: chapterCount,
            chapterCount,

            inLibrary: Boolean(item?.inLibrary ?? false),
          };
        })
        .filter(
          (item: any) =>
            item.bookId &&
            item.bookName &&
            item.bookName !== "Untitled"
        );

      return { dramas, rawCount: list.length, page: pageParam };
    },

    getNextPageParam: (lastPage: { rawCount: number; page: number }) =>
      lastPage.rawCount >= 20 ? lastPage.page + 1 : undefined,

    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  const seen = new Set<string>();
  const dramas = query.data?.pages.flatMap((page: any) =>
    page.dramas.filter((drama: any) => {
      if (seen.has(drama.bookId)) return false;
      seen.add(drama.bookId);
      return true;
    }),
  );

  return { ...query, data: dramas };
}
