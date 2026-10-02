"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

type Episode = {
  id?: string | number;
  chapterId?: string | number;
  episodeId?: string | number;
  chapterName?: string;
  episodeName?: string;
  title?: string;
  name?: string;
  [key: string]: any;
};

export default function MeloShortWatchPage() {
  const params = useParams();
  const router = useRouter();

  const bookId = String(params.bookId || "");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [episodeMenuOpen, setEpisodeMenuOpen] = useState(false);
  const [videoError, setVideoError] = useState(false);

  /* =========================
     DETAIL DRAMA
  ========================= */

  const {
    data: detailData,
    isLoading: loadingDetail,
    error: detailError,
  } = useQuery({
    queryKey: ["meloshort-watch-detail", bookId],

    queryFn: async () => {
      const res = await fetch(
        `/api/meloshort?path=/api/v2/detail&id=${encodeURIComponent(
          bookId
        )}&lang=id`
      );

      if (!res.ok) {
        throw new Error("Gagal mengambil detail drama");
      }

      const json = await res.json();

      console.log("MELOSHORT DETAIL:", json);

      return json.data || json;
    },

    enabled: !!bookId,
  });

  /* =========================
     DAFTAR EPISODE
  ========================= */

  const episodes: Episode[] = useMemo(() => {
    if (!detailData) return [];

    const list =
      detailData.episodes ||
      detailData.chapters ||
      detailData.chapterList ||
      detailData.videoList ||
      detailData.list ||
      [];

    return Array.isArray(list) ? list : [];
  }, [detailData]);

  const currentEpisode = episodes[currentEpisodeIndex];

  /* =========================
     CHAPTER ID
  ========================= */

  const chapterId = currentEpisode
    ? String(
        currentEpisode.chapterId ??
          currentEpisode.id ??
          currentEpisode.episodeId ??
          ""
      )
    : "";

  /* =========================
     VIDEO API
  ========================= */

  const {
    data: videoData,
    isLoading: loadingVideo,
    error: videoQueryError,
  } = useQuery({
    queryKey: [
      "meloshort-watch-video",
      bookId,
      chapterId,
    ],

    queryFn: async () => {
      const res = await fetch(
        `/api/meloshort?path=/api/v2/video&id=${encodeURIComponent(
          bookId
        )}&chapterId=${encodeURIComponent(
          chapterId
        )}&lang=id`
      );

      if (!res.ok) {
        throw new Error(
          `Gagal mengambil video (${res.status})`
        );
      }

      const json = await res.json();

      console.log("MELOSHORT VIDEO:", json);

      return json.data || json;
    },

    enabled: !!bookId && !!chapterId,
  });

  /* =========================
     AMBIL STREAM
  ========================= */

  const streamInfo = useMemo(() => {
    if (!videoData) return null;

    const streams =
      videoData.streams ||
      videoData.videoList ||
      videoData.sources ||
      [];

    const firstStream =
      Array.isArray(streams) && streams.length > 0
        ? streams[0]
        : null;

    const url =
      videoData.url ||
      videoData.videoUrl ||
      videoData.playUrl ||
      firstStream?.url ||
      "";

    const headers =
      videoData.streamHeaders ||
      firstStream?.streamHeaders ||
      firstStream?.headers ||
      videoData.headers ||
      {};

    return {
      url,
      headers,
    };
  }, [videoData]);

  /* =========================
     PROXY STREAM
  ========================= */

  const proxiedVideoUrl = useMemo(() => {
    if (!streamInfo?.url) return "";

    return (
      `/api/meloshort/stream?url=${encodeURIComponent(
        streamInfo.url
      )}` +
      `&headers=${encodeURIComponent(
        JSON.stringify(streamInfo.headers || {})
      )}`
    );
  }, [streamInfo]);

  /* =========================
     LOAD VIDEO
  ========================= */

  useEffect(() => {
    setVideoError(false);

    const video = videoRef.current;

    if (!video || !proxiedVideoUrl) return;

    video.pause();
    video.removeAttribute("src");
    video.load();

    video.src = proxiedVideoUrl;

    /*
     * Jangan paksa autoplay.
     * Mobile browser sering memblokir autoplay.
     */
    video.load();

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [proxiedVideoUrl]);

  /* =========================
     JUDUL EPISODE
  ========================= */

  const getEpisodeTitle = (
    episode: Episode,
    index: number
  ) => {
    return (
      episode.episodeName ||
      episode.chapterName ||
      episode.title ||
      episode.name ||
      `Episode ${index + 1}`
    );
  };

  /* =========================
     PILIH EPISODE
  ========================= */

  const selectEpisode = (index: number) => {
    if (index < 0 || index >= episodes.length) {
      return;
    }

    setCurrentEpisodeIndex(index);
    setEpisodeMenuOpen(false);
    setVideoError(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================
     LOADING DETAIL
  ========================= */

  if (loadingDetail) {
    return (
      <main className="min-h-screen bg-[#07090d] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />

          <p className="text-white/60">
            Memuat drama...
          </p>
        </div>
      </main>
    );
  }

  /* =========================
     ERROR DETAIL
  ========================= */

  if (detailError || !detailData) {
    return (
      <main className="min-h-screen bg-[#07090d] text-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">
            ⚠️
          </div>

          <p className="text-red-400 mb-4">
            Gagal memuat drama.
          </p>

          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15"
          >
            Kembali
          </button>
        </div>
      </main>
    );
  }

  /* =========================
     INFO DRAMA
  ========================= */

  const title =
    detailData.title ||
    detailData.bookName ||
    "MeloShort";

  const cover =
    detailData.cover ||
    detailData.coverWap ||
    detailData.image ||
    "";

  const description =
    detailData.description ||
    detailData.introduction ||
    detailData.desc ||
    "";

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="max-w-6xl mx-auto">
        {/* =====================
            HEADER
        ===================== */}

        <header className="h-16 px-4 flex items-center gap-3 border-b border-white/5">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"
          >
            ←
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="font-semibold truncate">
              {title}
            </h1>

            <p className="text-xs text-white/40">
              Episode {currentEpisodeIndex + 1}
              {episodes.length > 0
                ? ` / ${episodes.length}`
                : ""}
            </p>
          </div>
        </header>

        {/* =====================
            VIDEO PLAYER
        ===================== */}

        <section className="w-full bg-black">
          <div className="relative w-full aspect-video overflow-hidden">
            {/* VIDEO */}

            {!loadingVideo &&
              !videoQueryError &&
              proxiedVideoUrl &&
              !videoError && (
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  preload="metadata"
                  poster={cover}
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                  onError={() => {
                    setVideoError(true);
                  }}
                />
              )}

            {/* LOADING VIDEO */}

            {loadingVideo && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />

                <p className="text-sm text-white/50">
                  Memuat Episode{" "}
                  {currentEpisodeIndex + 1}...
                </p>
              </div>
            )}

            {/* VIDEO ERROR */}

            {!loadingVideo &&
              (videoQueryError ||
                videoError ||
                !proxiedVideoUrl) && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black p-6 text-center">
                  <div className="text-4xl mb-3">
                    ⚠️
                  </div>

                  <p className="text-sm text-white/70">
                    Video tidak dapat diputar.
                  </p>

                  <p className="text-xs text-white/35 mt-2">
                    Coba pilih episode lain.
                  </p>

                  <button
                    onClick={() =>
                      setVideoError(false)
                    }
                    className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-sm"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

            {/* =====================
                HAMBURGER
            ===================== */}

            <button
              onClick={() =>
                setEpisodeMenuOpen(
                  (value) => !value
                )
              }
              className="
                absolute
                top-3
                right-3
                z-30
                w-11
                h-11
                rounded-xl
                bg-black/70
                backdrop-blur-md
                border
                border-white/10
                flex
                items-center
                justify-center
                text-xl
                shadow-xl
              "
              aria-label="Daftar episode"
            >
              ☰
            </button>

            {/* =====================
                EPISODE DRAWER
            ===================== */}

            {episodeMenuOpen && (
              <>
                {/* BACKDROP */}

                <button
                  className="absolute inset-0 z-40 bg-black/50"
                  onClick={() =>
                    setEpisodeMenuOpen(false)
                  }
                  aria-label="Tutup daftar episode"
                />

                {/* DRAWER */}

                <aside
                  className="
                    absolute
                    top-0
                    right-0
                    bottom-0
                    z-50
                    w-[78%]
                    max-w-[320px]
                    bg-[#101217]/95
                    backdrop-blur-xl
                    border-l
                    border-white/10
                    shadow-2xl
                    flex
                    flex-col
                  "
                >
                  {/* DRAWER HEADER */}

                  <div className="p-4 flex items-center justify-between border-b border-white/10">
                    <div>
                      <h2 className="font-semibold">
                        Daftar Episode
                      </h2>

                      <p className="text-xs text-white/40 mt-1">
                        {episodes.length} episode
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setEpisodeMenuOpen(false)
                      }
                      className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-lg"
                    >
                      ×
                    </button>
                  </div>

                  {/* EPISODES */}

                  <div className="flex-1 overflow-y-auto p-3">
                    {episodes.length === 0 ? (
                      <p className="text-sm text-white/40 text-center py-8">
                        Episode tidak ditemukan.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {episodes.map(
                          (
                            episode,
                            index
                          ) => {
                            const active =
                              index ===
                              currentEpisodeIndex;

                            return (
                              <button
                                key={`${String(
                                  episode.chapterId ??
                                    episode.id ??
                                    episode.episodeId ??
                                    index
                                )}-${index}`}
                                onClick={() =>
                                  selectEpisode(
                                    index
                                  )
                                }
                                className={`
                                  h-10
                                  rounded-lg
                                  text-sm
                                  font-medium
                                  transition
                                  ${
                                    active
                                      ? "bg-white text-black"
                                      : "bg-white/5 text-white/70 hover:bg-white/10"
                                  }
                                `}
                              >
                                {index + 1}
                              </button>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                </aside>
              </>
            )}
          </div>
        </section>

        {/* =====================
            PREV / NEXT
        ===================== */}

        <div className="px-4 py-4 flex gap-2 border-b border-white/5">
          <button
            disabled={
              currentEpisodeIndex <= 0
            }
            onClick={() =>
              selectEpisode(
                currentEpisodeIndex - 1
              )
            }
            className="
              flex-1
              h-11
              rounded-xl
              bg-white/5
              hover:bg-white/10
              disabled:opacity-30
              disabled:hover:bg-white/5
              transition
            "
          >
            ← Sebelumnya
          </button>

          <button
            disabled={
              currentEpisodeIndex >=
              episodes.length - 1
            }
            onClick={() =>
              selectEpisode(
                currentEpisodeIndex + 1
              )
            }
            className="
              flex-1
              h-11
              rounded-xl
              bg-white/5
              hover:bg-white/10
              disabled:opacity-30
              disabled:hover:bg-white/5
              transition
            "
          >
            Berikutnya →
          </button>
        </div>

        {/* =====================
            DRAMA INFO
        ===================== */}

        <section className="p-5">
          <div className="flex gap-4">
            {cover && (
              <img
                src={cover}
                alt={title}
                className="w-20 h-28 rounded-xl object-cover bg-white/5 shrink-0"
              />
            )}

            <div className="min-w-0">
              <h2 className="font-semibold text-lg">
                {title}
              </h2>

              <p className="text-sm text-white/40 mt-1">
                Sedang menonton Episode{" "}
                {currentEpisodeIndex + 1}
              </p>
            </div>
          </div>

          {description && (
            <p className="mt-5 text-sm leading-6 text-white/60">
              {description}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
