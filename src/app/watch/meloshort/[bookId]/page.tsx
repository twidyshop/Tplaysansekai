"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

type Chapter = {
  id: string;
  index?: number;
  title?: string;
};

type Stream = {
  quality?: string;
  resolution?: string;
  url?: string;
};

type Subtitle = {
  language?: string;
  languageId?: number;
  format?: string;
  url?: string;
  index?: number;
};

export default function MeloShortWatchPage() {
  const params = useParams();
  const router = useRouter();

  const bookId = String(params.bookId || "");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [playerError, setPlayerError] = useState("");

  /*
   * ============================================================
   * 1. DETAIL DRAMA + CHAPTERS
   * ============================================================
   */

  const {
    data: detailData,
    isLoading: loadingDetail,
    error: detailError,
  } = useQuery({
    queryKey: ["meloshort-watch-detail", bookId],

    queryFn: async () => {
      const params = new URLSearchParams({
        path: "/api/v2/detail",
        id: bookId,
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
          `Respons detail MeloShort bukan JSON. HTTP ${res.status}`
        );
      }

      if (!res.ok || json?.success === false) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Gagal mengambil detail. HTTP ${res.status}`
        );
      }

      return json?.data ?? json;
    },

    enabled: !!bookId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  /*
   * API QuickPlay mendokumentasikan episode di:
   *
   * data.chapters[]
   *
   * setiap chapter:
   * {
   *   id: "ep_external_id",
   *   index: 1,
   *   title: "Episode 1"
   * }
   */

  const episodes: Chapter[] = useMemo(() => {
    if (!detailData) return [];

    const source =
      detailData.chapters ||
      detailData.episodes ||
      detailData.chapterList ||
      [];

    if (!Array.isArray(source)) return [];

    return source
      .map((episode: any, index: number) => {
        const id =
          episode?.id ??
          episode?.chapterId ??
          episode?.chapter_id ??
          episode?.episodeId ??
          episode?.episode_id;

        if (!id) return null;

        return {
          id: String(id),
          index: Number(episode?.index ?? index + 1),
          title: episode?.title || `Episode ${index + 1}`,
        };
      })
      .filter(Boolean) as Chapter[];
  }, [detailData]);

  /*
   * Pastikan index tidak keluar batas kalau API berubah.
   */

  useEffect(() => {
    if (
      episodes.length > 0 &&
      currentEpisodeIndex >= episodes.length
    ) {
      setCurrentEpisodeIndex(0);
    }
  }, [episodes.length, currentEpisodeIndex]);

  const currentEpisode = episodes[currentEpisodeIndex];

  /*
   * ============================================================
   * 2. AMBIL VIDEO EPISODE
   * ============================================================
   *
   * PENTING:
   *
   * API menggunakan:
   *
   * chapterId
   *
   * BUKAN:
   *
   * chapter_id
   */

  const {
    data: videoData,
    isLoading: loadingVideo,
    error: videoError,
  } = useQuery({
    queryKey: [
      "meloshort-watch-video",
      bookId,
      currentEpisode?.id,
    ],

    queryFn: async () => {
      if (!currentEpisode?.id) {
        throw new Error("Episode ID tidak ditemukan");
      }

      const params = new URLSearchParams({
        path: "/api/v2/video",
        id: bookId,
        chapterId: currentEpisode.id,
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
          `Respons video bukan JSON. HTTP ${res.status}`
        );
      }

      if (!res.ok || json?.success === false) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Gagal mengambil video. HTTP ${res.status}`
        );
      }

      return json?.data ?? json;
    },

    enabled: !!bookId && !!currentEpisode?.id,
    staleTime: 1000 * 60 * 10,
    retry: 2,
  });

  /*
   * ============================================================
   * 3. NORMALISASI STREAM
   * ============================================================
   */

  const streams: Stream[] = useMemo(() => {
    if (!videoData) return [];

    if (Array.isArray(videoData.streams)) {
      return videoData.streams.filter(
        (stream: any) => stream?.url
      );
    }

    if (videoData.url) {
      return [
        {
          url: videoData.url,
          quality: "Auto",
        },
      ];
    }

    if (videoData.videoUrl) {
      return [
        {
          url: videoData.videoUrl,
          quality: "Auto",
        },
      ];
    }

    return [];
  }, [videoData]);

  /*
   * Pilih kualitas tertinggi yang tersedia.
   *
   * Biasanya API mengembalikan:
   * 1080p
   * 720p
   * 480p
   */

  const videoUrl = useMemo(() => {
    if (!streams.length) return "";

    const getQuality = (stream: Stream) => {
      const value = String(
        stream.quality ||
          stream.resolution ||
          ""
      );

      const match = value.match(/\d+/);

      return match ? Number(match[0]) : 0;
    };

    return [...streams].sort(
      (a, b) => getQuality(b) - getQuality(a)
    )[0]?.url || "";
  }, [streams]);

  /*
   * ============================================================
   * 4. SUBTITLE
   * ============================================================
   */

  const subtitles: Subtitle[] = useMemo(() => {
    if (!Array.isArray(videoData?.subtitles)) {
      return [];
    }

    return videoData.subtitles.filter(
      (subtitle: Subtitle) => subtitle?.url
    );
  }, [videoData]);

  /*
   * ============================================================
   * 5. HLS PLAYER
   * ============================================================
   *
   * Kalau URL berupa .m3u8:
   *
   * Chrome/Android -> HLS.js
   * Safari/iOS -> native HLS
   *
   */

  useEffect(() => {
    let cancelled = false;

    async function setupPlayer() {
      const video = videoRef.current;

      if (!video || !videoUrl) return;

      setPlayerError("");

      /*
       * Destroy player sebelumnya
       */

      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}

        hlsRef.current = null;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();

      /*
       * Kalau bukan HLS, langsung gunakan URL.
       */

      const isHls =
        videoUrl.includes(".m3u8") ||
        videoUrl.includes("m3u8");

      if (!isHls) {
        video.src = videoUrl;

        try {
          await video.play();
        } catch {}

        return;
      }

      /*
       * Safari/iOS yang native HLS.
       */

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = videoUrl;

        try {
          await video.play();
        } catch {}

        return;
      }

      /*
       * Chrome / Android / browser lain:
       * load HLS.js dari CDN.
       */

      try {
        const existing = document.querySelector(
          'script[data-meloshort-hls="true"]'
        ) as HTMLScriptElement | null;

        if (!existing && !(window as any).Hls) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");

            script.src =
              "https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js";

            script.async = true;
            script.dataset.meloshortHls = "true";

            script.onload = () => resolve();
            script.onerror = () =>
              reject(
                new Error("Gagal memuat HLS.js")
              );

            document.head.appendChild(script);
          });
        }

        if (cancelled) return;

        const Hls = (window as any).Hls;

        if (!Hls || !Hls.isSupported()) {
          throw new Error(
            "Browser tidak mendukung pemutaran HLS."
          );
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,

          /*
           * Sedikit toleransi untuk CDN stream.
           */

          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });

        hlsRef.current = hls;

        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, async () => {
          if (cancelled) return;

          try {
            await video.play();
          } catch {}
        });

        hls.on(
          Hls.Events.ERROR,
          (_event: any, data: any) => {
            if (!data?.fatal) return;

            console.error(
              "MeloShort HLS error:",
              data
            );

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
              return;
            }

            if (
              data.type ===
              Hls.ErrorTypes.MEDIA_ERROR
            ) {
              hls.recoverMediaError();
              return;
            }

            setPlayerError(
              "Stream video gagal diputar. Silakan pilih episode lain."
            );

            try {
              hls.destroy();
            } catch {}
          }
        );
      } catch (error: any) {
        console.error(error);

        if (!cancelled) {
          setPlayerError(
            error?.message ||
              "Gagal menyiapkan pemutar video."
          );
        }
      }
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
    };
  }, [videoUrl]);

  /*
   * ============================================================
   * 6. SUBTITLE TRACK
   * ============================================================
   */

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    /*
     * Hapus track subtitle lama.
     */

    Array.from(video.querySelectorAll("track")).forEach(
      (track) => track.remove()
    );

    /*
     * Tambahkan subtitle Indonesia jika tersedia.
     */

    const subtitle =
      subtitles.find(
        (item) =>
          String(item.language || "").toLowerCase() ===
            "id" ||
          String(item.language || "").toLowerCase() ===
            "indonesia"
      ) || subtitles[0];

    if (!subtitle?.url) return;

    const track = document.createElement("track");

    track.kind = "subtitles";
    track.src = subtitle.url;
    track.srclang =
      subtitle.language || "id";
    track.label =
      subtitle.language || "Indonesia";
    track.default = true;

    video.appendChild(track);
  }, [subtitles, videoUrl]);

  /*
   * ============================================================
   * 7. NEXT / PREVIOUS
   * ============================================================
   */

  const goNext = () => {
    if (
      currentEpisodeIndex <
      episodes.length - 1
    ) {
      setCurrentEpisodeIndex(
        currentEpisodeIndex + 1
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const goPrevious = () => {
    if (currentEpisodeIndex > 0) {
      setCurrentEpisodeIndex(
        currentEpisodeIndex - 1
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  /*
   * ============================================================
   * LOADING DETAIL
   * ============================================================
   */

  if (loadingDetail) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-zinc-700 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-300">
            Memuat episode MeloShort...
          </p>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * DETAIL ERROR
   * ============================================================
   */

  if (detailError || !detailData) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-500 text-lg font-semibold mb-2">
          Gagal memuat drama
        </p>

        <p className="text-zinc-500 text-sm mb-5">
          {detailError instanceof Error
            ? detailError.message
            : "Data drama tidak ditemukan."}
        </p>

        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-purple-600 rounded-xl font-semibold"
        >
          ← Kembali
        </button>
      </div>
    );
  }

  const title =
    detailData.title ||
    detailData.bookName ||
    "MeloShort";

  /*
   * ============================================================
   * PLAYER PAGE
   * ============================================================
   */

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* HEADER */}

      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm"
          >
            ←
          </button>

          <div className="min-w-0">
            <h1 className="font-semibold truncate">
              {title}
            </h1>

            <p className="text-xs text-zinc-500">
              {currentEpisode?.title ||
                `Episode ${currentEpisodeIndex + 1}`}
            </p>
          </div>
        </div>
      </header>

      {/* CONTENT */}

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          {/* PLAYER */}

          <section>
            <div className="bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
              <div className="aspect-video bg-black flex items-center justify-center relative">
                {loadingVideo ? (
                  <div className="text-center">
                    <div className="w-9 h-9 border-4 border-zinc-700 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />

                    <p className="text-zinc-400 text-sm">
                      Memuat{" "}
                      {currentEpisode?.title ||
                        `Episode ${
                          currentEpisodeIndex + 1
                        }`}
                      ...
                    </p>
                  </div>
                ) : videoError ? (
                  <div className="text-center p-6">
                    <p className="text-red-400 font-medium mb-2">
                      Gagal memuat video
                    </p>

                    <p className="text-xs text-zinc-600">
                      {videoError instanceof Error
                        ? videoError.message
                        : "Stream tidak tersedia."}
                    </p>
                  </div>
                ) : videoUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />

                    {playerError && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/80 px-4 py-3 text-center">
                        <p className="text-red-400 text-sm">
                          {playerError}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-6">
                    <p className="text-zinc-400">
                      Stream episode tidak tersedia.
                    </p>

                    <p className="text-xs text-zinc-600 mt-2">
                      Chapter ID:{" "}
                      {currentEpisode?.id ||
                        "-"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* EPISODE INFO */}

            <div className="mt-4">
              <h2 className="text-lg md:text-xl font-bold">
                {title}
              </h2>

              <p className="text-sm text-zinc-500 mt-1">
                {currentEpisode?.title ||
                  `Episode ${
                    currentEpisodeIndex + 1
                  }`}
              </p>

              {/* PLAYER CONTROLS */}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={goPrevious}
                  disabled={
                    currentEpisodeIndex === 0
                  }
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 disabled:opacity-30 hover:bg-zinc-700 transition text-sm font-medium"
                >
                  ← Sebelumnya
                </button>

                <button
                  onClick={goNext}
                  disabled={
                    currentEpisodeIndex >=
                    episodes.length - 1
                  }
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 disabled:opacity-30 hover:bg-purple-700 transition text-sm font-medium"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          </section>

          {/* EPISODE LIST */}

          <aside className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden lg:max-h-[calc(100vh-100px)] lg:sticky lg:top-[80px]">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">
                  Daftar Episode
                </h2>

                <span className="text-xs text-zinc-500">
                  {episodes.length} Episode
                </span>
              </div>
            </div>

            <div className="p-3 overflow-y-auto lg:max-h-[calc(100vh-170px)]">
              {episodes.length === 0 ? (
                <div className="py-10 text-center text-zinc-500 text-sm">
                  Episode tidak ditemukan.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-3 gap-2">
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
                          key={`${episode.id}-${index}`}
                          onClick={() => {
                            if (
                              index !==
                              currentEpisodeIndex
                            ) {
                              setPlayerError("");
                              setCurrentEpisodeIndex(
                                index
                              );
                            }
                          }}
                          className={`min-h-11 rounded-xl text-xs sm:text-sm font-semibold transition ${
                            active
                              ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30"
                              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                          }`}
                          title={
                            episode.title ||
                            `Episode ${
                              index + 1
                            }`
                          }
                        >
                          {episode.index ??
                            index + 1}
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
