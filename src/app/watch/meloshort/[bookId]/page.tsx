"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

type Episode = {
  id?: string | number;
  chapterId?: string | number;
  episodeId?: string | number;
  name?: string;
  title?: string;
  episodeName?: string;
  episode?: number | string;
  chapterName?: string;
  [key: string]: any;
};

type Stream = {
  url?: string;
  src?: string;
  streamUrl?: string;
  videoUrl?: string;
  playUrl?: string;
  type?: string;
  mimeType?: string;
  contentType?: string;
  quality?: string;
  name?: string;
  label?: string;
  headers?: Record<string, string>;
  streamHeaders?: Record<string, string>;
  [key: string]: any;
};

function getEpisodeId(ep: Episode) {
  return String(
    ep.chapterId ??
      ep.episodeId ??
      ep.id ??
      ""
  );
}

function getEpisodeTitle(ep: Episode, index: number) {
  return (
    ep.name ||
    ep.title ||
    ep.episodeName ||
    ep.chapterName ||
    ep.episode ||
    `Episode ${index + 1}`
  );
}

function getStreamUrl(stream: Stream) {
  return (
    stream.url ||
    stream.src ||
    stream.streamUrl ||
    stream.videoUrl ||
    stream.playUrl ||
    ""
  );
}

function isVideoStream(stream: Stream) {
  const url = getStreamUrl(stream).toLowerCase();

  const type = String(
    stream.type ||
      stream.mimeType ||
      stream.contentType ||
      ""
  ).toLowerCase();

  const combined = `${url} ${type}`;

  // Hindari stream audio-only
  if (
    combined.includes("audio/mp4") ||
    combined.includes("audio/mpeg") ||
    combined.includes("audio/aac") ||
    combined.includes("audio-only")
  ) {
    return false;
  }

  // Prioritaskan HLS / video
  if (
    combined.includes(".m3u8") ||
    combined.includes("application/vnd.apple.mpegurl") ||
    combined.includes("video/")
  ) {
    return true;
  }

  // Kalau API tidak memberi MIME type,
  // anggap URL stream sebagai kandidat video.
  return !!url;
}

export default function MeloShortWatchPage() {
  const params = useParams();
  const router = useRouter();

  const bookId = String(params.bookId || "");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  const [selectedEpisode, setSelectedEpisode] =
    useState<number>(0);

  const [episodeDrawer, setEpisodeDrawer] =
    useState(false);

  const [playerError, setPlayerError] =
    useState("");

  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ["meloshort-watch-detail", bookId],

    queryFn: async () => {
      const res = await fetch(
        `/api/meloshort?path=/api/v2/detail&id=${encodeURIComponent(
          bookId
        )}&lang=id`,
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error("Gagal mengambil detail drama");
      }

      const json = await res.json();

      console.log(
        "========== MELOSHORT DETAIL ==========",
        json
      );

      return json.data || json;
    },

    enabled: !!bookId,
  });

  const episodes: Episode[] = useMemo(() => {
    if (!detail) return [];

    const list =
      detail.episodes ||
      detail.chapters ||
      detail.chapterList ||
      detail.videoList ||
      detail.list ||
      [];

    return Array.isArray(list) ? list : [];
  }, [detail]);

  const currentEpisode =
    episodes[selectedEpisode] || null;

  const currentEpisodeId = currentEpisode
    ? getEpisodeId(currentEpisode)
    : "";

  const {
    data: videoData,
    isLoading: videoLoading,
    error: videoError,
  } = useQuery({
    queryKey: [
      "meloshort-watch-video",
      bookId,
      currentEpisodeId,
    ],

    queryFn: async () => {
      if (!currentEpisodeId) {
        throw new Error("ID episode tidak ditemukan");
      }

      const url =
        `/api/meloshort?path=/api/v2/video` +
        `&id=${encodeURIComponent(bookId)}` +
        `&chapterId=${encodeURIComponent(currentEpisodeId)}` +
        `&lang=id`;

      const res = await fetch(url, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(
          `Gagal mengambil video (${res.status})`
        );
      }

      const json = await res.json();

      console.log(
        "========== MELOSHORT VIDEO RAW ==========",
        JSON.stringify(json, null, 2)
      );

      return json.data || json;
    },

    enabled:
      !!bookId &&
      !!currentEpisodeId,
  });

  const streams: Stream[] = useMemo(() => {
    if (!videoData) return [];

    const raw =
      videoData.streams ||
      videoData.videoList ||
      videoData.sources ||
      videoData.data ||
      [];

    if (Array.isArray(raw)) {
      return raw;
    }

    // Kadang API langsung mengembalikan object stream
    if (typeof raw === "object" && raw !== null) {
      return [raw];
    }

    return [];
  }, [videoData]);

  const selectedStream = useMemo(() => {
    if (!streams.length) return null;

    // Prioritas:
    // 1. HLS/video stream
    // 2. stream yang bukan audio-only
    // 3. stream pertama sebagai fallback
    return (
      streams.find(isVideoStream) ||
      streams.find((stream) => {
        const url = getStreamUrl(stream).toLowerCase();

        return (
          url.includes(".mp4") ||
          url.includes(".m3u8") ||
          url.includes("video")
        );
      }) ||
      streams[0]
    );
  }, [streams]);

  const originalStreamUrl = selectedStream
    ? getStreamUrl(selectedStream)
    : "";

  const streamHeaders =
    selectedStream?.headers ||
    selectedStream?.streamHeaders ||
    {};

  const proxiedStreamUrl = useMemo(() => {
    if (!originalStreamUrl) return "";

    return (
      `/api/meloshort/stream?url=` +
      `${encodeURIComponent(originalStreamUrl)}` +
      `&headers=` +
      `${encodeURIComponent(
        JSON.stringify(streamHeaders)
      )}`
    );
  }, [
    originalStreamUrl,
    streamHeaders,
  ]);

  const title =
    detail?.title ||
    detail?.bookName ||
    detail?.name ||
    "MeloShort";

  const cover =
    detail?.cover ||
    detail?.coverWap ||
    detail?.image ||
    "";

  const description =
    detail?.description ||
    detail?.introduction ||
    detail?.desc ||
    "";

  /*
   * ==========================================
   * HLS PLAYER
   * ==========================================
   */
  useEffect(() => {
    let cancelled = false;

    async function setupPlayer() {
      const video = videoRef.current;

      if (!video || !proxiedStreamUrl) {
        return;
      }

      setPlayerError("");

      // Bersihkan HLS sebelumnya
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}

        hlsRef.current = null;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();

      const isHls =
        originalStreamUrl
          .toLowerCase()
          .includes(".m3u8") ||
        proxiedStreamUrl
          .toLowerCase()
          .includes(".m3u8");

      /*
       * Safari / browser yang punya native HLS
       */
      if (
        isHls &&
        video.canPlayType(
          "application/vnd.apple.mpegurl"
        )
      ) {
        video.src = proxiedStreamUrl;

        try {
          await video.play();
        } catch {}

        return;
      }

      /*
       * Chrome / Android / browser lain:
       * gunakan HLS.js
       */
      if (isHls) {
        try {
          const HlsModule =
            await import("hls.js");

          const Hls =
            HlsModule.default;

          if (cancelled) return;

          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,

              // Biar player memilih video rendition
              // yang sesuai bandwidth perangkat.
              startLevel: -1,

              capLevelToPlayerSize: true,

              maxBufferLength: 30,

              backBufferLength: 30,
            });

            hlsRef.current = hls;

            hls.loadSource(
              proxiedStreamUrl
            );

            hls.attachMedia(video);

            hls.on(
              Hls.Events.MANIFEST_PARSED,
              () => {
                if (cancelled) return;

                video
                  .play()
                  .catch(() => {});
              }
            );

            hls.on(
              Hls.Events.ERROR,
              (
                _event: any,
                data: any
              ) => {
                console.error(
                  "HLS ERROR:",
                  data
                );

                if (
                  data?.fatal
                ) {
                  setPlayerError(
                    "Video gagal dimuat. Coba pilih episode lain."
                  );

                  try {
                    if (
                      data.type ===
                      Hls.ErrorTypes.NETWORK_ERROR
                    ) {
                      hls.startLoad();
                    } else if (
                      data.type ===
                      Hls.ErrorTypes.MEDIA_ERROR
                    ) {
                      hls.recoverMediaError();
                    }
                  } catch {}
                }
              }
            );

            return;
          }
        } catch (error) {
          console.error(
            "HLS.js gagal dimuat:",
            error
          );
        }
      }

      /*
       * Fallback untuk MP4/direct video
       */
      video.src = proxiedStreamUrl;

      try {
        await video.play();
      } catch {}
    }

    setupPlayer();

    return () => {
      cancelled = true;

      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}

        hlsRef.current = null;
      }

      const video =
        videoRef.current;

      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [
    proxiedStreamUrl,
    originalStreamUrl,
  ]);

  /*
   * ==========================================
   * LOADING
   * ==========================================
   */

  if (detailLoading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">
            Memuat drama...
          </p>
        </div>
      </main>
    );
  }

  if (
    detailError ||
    !detail
  ) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">
            Gagal memuat drama.
          </p>

          <button
            onClick={() =>
              router.back()
            }
            className="px-5 py-2.5 rounded-xl bg-white text-black"
          >
            Kembali
          </button>
        </div>
      </main>
    );
  }

  /*
   * ==========================================
   * MAIN
   * ==========================================
   */

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto">
        {/* PLAYER */}
        <div className="relative bg-black aspect-video">
          {videoLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />

                <p className="text-sm text-white/60">
                  Memuat video...
                </p>
              </div>
            </div>
          ) : videoError ||
            !originalStreamUrl ? (
            <div
              className="absolute inset-0 flex items-center justify-center bg-zinc-950"
              style={{
                backgroundImage: cover
                  ? `url("${cover}")`
                  : undefined,
                backgroundSize: "cover",
                backgroundPosition:
                  "center",
              }}
            >
              <div className="absolute inset-0 bg-black/70" />

              <div className="relative z-10 text-center px-6">
                <p className="text-red-400 mb-2">
                  Video tidak tersedia
                </p>

                <p className="text-sm text-white/60">
                  Stream episode ini tidak
                  ditemukan.
                </p>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                poster={cover}
                className="w-full h-full object-contain bg-black"
              />

              {/* HAMBURGER EPISODE */}
              <button
                type="button"
                onClick={() =>
                  setEpisodeDrawer(
                    true
                  )
                }
                className="absolute top-4 right-4 z-20 w-11 h-11 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/90 transition"
                aria-label="Daftar episode"
              >
                <span className="text-xl">
                  ☰
                </span>
              </button>

              {playerError && (
                <div className="absolute bottom-16 left-4 right-4 z-20 rounded-xl bg-red-950/90 border border-red-500/20 px-4 py-3 text-sm text-red-200">
                  {playerError}
                </div>
              )}
            </>
          )}
        </div>

        {/* INFO */}
        <section className="px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight">
                {title}
              </h1>

              {episodes.length > 0 && (
                <p className="text-sm text-white/50 mt-1">
                  Episode{" "}
                  {selectedEpisode + 1}{" "}
                  dari {episodes.length}
                </p>
              )}
            </div>

            <button
              onClick={() =>
                router.back()
              }
              className="shrink-0 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
            >
              Kembali
            </button>
          </div>

          {description && (
            <p className="mt-4 text-sm leading-6 text-white/60">
              {description}
            </p>
          )}
        </section>

        {/* PREVIOUS / NEXT */}
        {episodes.length > 0 && (
          <div className="px-4 pb-6 flex gap-3">
            <button
              disabled={
                selectedEpisode <= 0
              }
              onClick={() => {
                setSelectedEpisode(
                  (value) =>
                    Math.max(
                      0,
                      value - 1
                    )
                );

                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
              }}
              className="flex-1 py-3 rounded-xl bg-white/10 disabled:opacity-30"
            >
              ← Sebelumnya
            </button>

            <button
              disabled={
                selectedEpisode >=
                episodes.length - 1
              }
              onClick={() => {
                setSelectedEpisode(
                  (value) =>
                    Math.min(
                      episodes.length - 1,
                      value + 1
                    )
                );

                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
              }}
              className="flex-1 py-3 rounded-xl bg-white/10 disabled:opacity-30"
            >
              Berikutnya →
            </button>
          </div>
        )}
      </div>

      {/* ======================================
          EPISODE DRAWER
          ====================================== */}

      {episodeDrawer && (
        <div className="fixed inset-0 z-50">
          {/* BACKDROP */}
          <button
            type="button"
            aria-label="Tutup"
            onClick={() =>
              setEpisodeDrawer(false)
            }
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* DRAWER */}
          <aside className="absolute top-0 right-0 h-full w-[88%] max-w-md bg-zinc-950 border-l border-white/10 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h2 className="font-bold">
                  Daftar Episode
                </h2>

                <p className="text-xs text-white/40 mt-1">
                  {episodes.length} episode
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEpisodeDrawer(
                    false
                  )
                }
                className="w-10 h-10 rounded-xl bg-white/10 text-lg"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {episodes.length === 0 ? (
                <div className="text-center py-10 text-white/40 text-sm">
                  Episode tidak ditemukan.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {episodes.map(
                    (
                      episode,
                      index
                    ) => {
                      const active =
                        index ===
                        selectedEpisode;

                      return (
                        <button
                          key={`${getEpisodeId(
                            episode
                          )}-${index}`}
                          type="button"
                          onClick={() => {
                            setSelectedEpisode(
                              index
                            );

                            setEpisodeDrawer(
                              false
                            );

                            window.scrollTo({
                              top: 0,
                              behavior:
                                "smooth",
                            });
                          }}
                          className={`
                            min-h-[48px]
                            rounded-xl
                            px-2
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
                          {getEpisodeTitle(
                            episode,
                            index
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
