"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function pickIndonesianText(
  item: any,
  fields: string[],
  fallback = ""
): string {
  if (!item) return fallback;

  // Field eksplisit Indonesia.
  const indonesiaKeys = [
    ...fields.map((key) => `${key}_id`),
    ...fields.map((key) => `${key}Id`),
    ...fields.map((key) => `${key}_ID`),
    ...fields.map((key) => `${key}_indonesia`),
    ...fields.map((key) => `${key}Indonesia`),
  ];

  for (const key of indonesiaKeys) {
    const text = cleanText(item?.[key]);
    if (text) return text;
  }

  // Object multilingual.
  for (const key of fields) {
    const value = item?.[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const idText = cleanText(
        value?.id ??
          value?.ID ??
          value?.id_ID ??
          value?.["id-ID"] ??
          value?.ind ??
          value?.indonesia ??
          value?.Indonesia
      );

      if (idText) return idText;
    }
  }

  // Array translations.
  for (const key of fields) {
    const value = item?.[key];

    if (Array.isArray(value)) {
      for (const translation of value) {
        if (!translation || typeof translation !== "object") continue;

        const language = String(
          translation?.language ??
            translation?.languageCode ??
            translation?.lang ??
            translation?.locale ??
            ""
        ).toLowerCase();

        const isIndonesia =
          language === "id" ||
          language === "ind" ||
          language === "indonesia" ||
          language === "id-id" ||
          language === "ind-id";

        if (!isIndonesia) continue;

        const text = cleanText(
          translation?.text ??
            translation?.value ??
            translation?.title ??
            translation?.name ??
            translation?.content
        );

        if (text) return text;
      }
    }
  }

  // Field normal.
  for (const key of fields) {
    const text = cleanText(item?.[key]);
    if (text) return text;
  }

  return fallback;
}

function pickCover(detail: any): string {
  return (
    cleanText(detail?.coverWap) ||
    cleanText(detail?.cover) ||
    cleanText(detail?.cover_url) ||
    cleanText(detail?.coverUrl) ||
    cleanText(detail?.book_pic) ||
    cleanText(detail?.bookPic) ||
    cleanText(detail?.cover_pic) ||
    cleanText(detail?.image) ||
    cleanText(detail?.imageUrl) ||
    ""
  );
}

function pickTags(detail: any): string[] {
  const source =
    detail?.tags ??
    detail?.tagNames ??
    detail?.book_theme ??
    detail?.bookTheme ??
    detail?.themes ??
    [];

  if (!Array.isArray(source)) return [];

  return source
    .map((tag: any) => {
      if (typeof tag === "string") {
        return tag.trim();
      }

      return (
        cleanText(tag?.tagName) ||
        cleanText(tag?.name) ||
        cleanText(tag?.title) ||
        cleanText(tag?.value)
      );
    })
    .filter(Boolean);
}

function unwrapDetail(json: any): any {
  let data = json?.data ?? json;

  /*
   * Beberapa API membungkus detail beberapa kali.
   */
  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    if (
      data.detail &&
      typeof data.detail === "object"
    ) {
      data = data.detail;
    } else if (
      data.book &&
      typeof data.book === "object"
    ) {
      data = data.book;
    } else if (
      data.data &&
      typeof data.data === "object" &&
      !Array.isArray(data.data)
    ) {
      data = data.data;
    }
  }

  return data;
}

export default function MeloShortDetailPage() {
  const params = useParams();
  const router = useRouter();

  const bookId = String(params.bookId || "");

  const {
    data: detail,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["meloshort-detail-page", bookId, "id"],

    queryFn: async () => {
      const params = new URLSearchParams({
        path: "/api/v2/detail",
        id: bookId,
        category_p: "meloshort",
        lang: "id",
      });

      const res = await fetch(
        `/api/meloshort?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const raw = await res.text();

      let json: any;

      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(
          `Respons detail MeloShort bukan JSON (HTTP ${res.status})`
        );
      }

      if (!res.ok || json?.success === false) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Gagal mengambil detail MeloShort (${res.status})`
        );
      }

      return unwrapDetail(json);
    },

    enabled: Boolean(bookId),

    staleTime: 1000 * 60 * 5,

    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="animate-pulse text-lg">
          Memuat detail drama...
        </p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <p className="text-red-500 mb-4 text-lg font-semibold">
          Drama tidak ditemukan
        </p>

        <p className="text-zinc-400 text-sm mb-6 text-center max-w-md">
          Tidak dapat memuat detail drama. Silakan coba lagi
          atau kembali ke beranda.
        </p>

        <button
          onClick={() => router.push("/")}
          className="px-6 py-2.5 bg-purple-600 rounded-xl font-medium hover:bg-purple-700 transition"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  /*
   * Judul:
   * prioritaskan field Indonesia sebelum field generik.
   */
  const title =
    pickIndonesianText(
      detail,
      [
        "bookName",
        "book_name",
        "title",
        "name",
        "bookTitle",
        "book_title",
      ],
      "Judul Tidak Tersedia"
    );

  const cover = pickCover(detail);

  /*
   * Sinopsis:
   * ini yang sebelumnya sering kosong.
   */
  const description =
    pickIndonesianText(
      detail,
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
      ],
      ""
    );

  const tags = pickTags(detail);

  const chapterCount = Number(
    detail?.chapterCount ??
      detail?.chapter_count ??
      detail?.total_episodes ??
      detail?.totalEpisodes ??
      detail?.episodeCount ??
      detail?.episode_count ??
      detail?.chapters?.length ??
      0
  );

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition"
          >
            <span className="text-xl leading-none">‹</span>
            Kembali
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 md:gap-10">
          {/* Cover */}
          <div className="w-full max-w-[280px] mx-auto md:mx-0">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl">
              {cover ? (
                <img
                  src={cover}
                  alt={title}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <section className="flex flex-col min-w-0">
            <div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium mb-3">
                MeloShort
              </div>

              <h1 className="text-2xl md:text-4xl font-bold leading-tight mb-4">
                {title}
              </h1>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {tags.map((tag, index) => (
                    <span
                      key={`${tag}-${index}`}
                      className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {description ? (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-white mb-2">
                    Sinopsis
                  </h2>

                  <p className="text-sm md:text-base leading-7 text-zinc-400 whitespace-pre-line">
                    {description}
                  </p>
                </div>
              ) : (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-white mb-2">
                    Sinopsis
                  </h2>

                  <p className="text-sm text-zinc-600">
                    Sinopsis tidak tersedia dari API.
                  </p>
                </div>
              )}

              {chapterCount > 0 && (
                <div className="text-sm text-zinc-500 mb-6">
                  {chapterCount} episode
                </div>
              )}
            </div>

            {/* Watch */}
            <button
              onClick={() =>
                router.push(`/watch/meloshort/${bookId}`)
              }
              className="w-full md:w-auto md:min-w-[220px] py-3.5 px-7 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 transition flex items-center justify-center gap-2"
            >
              <span>▶</span>
              Mulai Nonton
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
