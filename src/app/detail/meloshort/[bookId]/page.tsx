"use client";

import { useParams, useRouter } from "next/navigation";
import { useMeloShortDetail, extractMeloShortEpisodes, extractMeloShortText } from "@/hooks/useMeloShort";

export default function MeloShortDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.bookId || "");

  const detailQuery = useMeloShortDetail(id);

  const detail = detailQuery.data;
  const title = extractMeloShortText(
    detail,
    ["title", "bookName", "book_name", "dramaName", "name"],
    "MeloShort",
  );
  const cover = extractMeloShortText(
    detail,
    [
      "cover",
      "coverUrl",
      "cover_url",
      "poster",
      "posterUrl",
      "image",
      "thumbnail",
      "book_pic",
    ],
    "",
  );
  const description = extractMeloShortText(
    detail,
    ["synopsis", "introduction", "description", "desc", "summary"],
    "",
  );
  const episodes = extractMeloShortEpisodes(detail);

  return (
    <main className="min-h-screen bg-[#0a0e27] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e27]/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-white/70 hover:text-white"
          >
            ‹&nbsp; Kembali
          </button>
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {detailQuery.isLoading ? (
          <p className="text-white/50">Memuat detail MeloShort...</p>
        ) : detailQuery.error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-5 text-red-300">
            Gagal memuat detail MeloShort.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-7 md:grid-cols-[280px_1fr]">
            <div className="mx-auto w-full max-w-[280px]">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                {cover ? (
                  <img
                    src={cover}
                    alt={title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/30">
                    No Image
                  </div>
                )}
              </div>
            </div>

            <section>
              <span className="mb-3 inline-flex rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs font-medium text-purple-300">
                MeloShort
              </span>

              <h1 className="mb-4 text-3xl font-bold leading-tight md:text-4xl">
                {title}
              </h1>

              {description && (
                <div className="mb-6">
                  <h2 className="mb-2 text-sm font-semibold">Sinopsis</h2>
                  <p className="whitespace-pre-line text-sm leading-7 text-white/55 md:text-base">
                    {description}
                  </p>
                </div>
              )}

              {episodes.length > 0 && (
                <p className="mb-6 text-sm text-white/45">
                  {episodes.length} episode
                </p>
              )}

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/watch/meloshort/" + encodeURIComponent(id),
                  )
                }
                className="w-full rounded-xl bg-purple-600 px-7 py-3.5 font-bold text-white hover:bg-purple-500 md:w-auto md:min-w-[220px]"
              >
                ▶&nbsp; Mulai Nonton
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
