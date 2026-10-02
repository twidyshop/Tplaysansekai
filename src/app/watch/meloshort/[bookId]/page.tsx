"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";

type Episode = {
  id?: string | number;
  chapterId?: string | number;
  episodeId?: string | number;
  title?: string;
  name?: string;
  episode?: string | number;
  chapter?: string | number;
  index?: number;
  episode_index?: number;
  [key: string]: any;
};

type Stream = {
  url?: string;
  quality?: string;
  resolution?: string;
  type?: string;
  mimeType?: string;
  contentType?: string;
  format?: string;
  headers?: Record<string, string> | null;
  streamHeaders?: Record<string, string> | null;
  [key: string]: any;
};

type Subtitle = {
  url: string;
  language?: string;
  languageCode?: string;
  format?: string;
  label?: string;
  [key: string]: any;
};

type DetailResponse = {
  success?: boolean;
  data?: any;
};

type VideoResponse = {
  success?: boolean;
  data?: {
    streams?: Stream[];
    subtitles?: Subtitle[];
    streamHeaders?: Record<string, string> | null;
    title?: string;
    duration?: number;
    episode_index?: number;
    total_episodes?: number;
    next_video_id?: string;
    prev_video_id?: string;
    [key: string]: any;
  };
};

function getEpisodeId(episode: Episode) {
  return String(
    episode.chapterId ??
      episode.episodeId ??
      episode.id ??
      episode.chapter ??
      episode.episode ??
      ""
  );
}

function getEpisodeTitle(
  episode: Episode,
  index: number
) {
  return (
    episode.title ||
    episode.name ||
    (episode.episode != null
      ? `Episode ${episode.episode}`
      : episode.chapter != null
      ? `Episode ${episode.chapter}`
      : `Episode ${index + 1}`)
  );
}

function getStreamHeaders(
  stream: Stream,
  videoData: VideoResponse["data"]
) {
  const headers =
    stream.headers ||
    stream.streamHeaders ||
    videoData?.streamHeaders ||
    {};

  if (
    headers &&
    typeof headers === "object" &&
    !Array.isArray(headers)
  ) {
    return headers as Record<string, string>;
  }

  return {};
}

function isProbablyVideoStream(stream: Stream) {
  const url = String(stream.url || "").toLowerCase();

  const mime = String(
    stream.mimeType ||
      stream.contentType ||
      stream.type ||
      stream.format ||
      ""
  ).toLowerCase();

  const resolution = String(
    stream.resolution || ""
  ).toLowerCase();

  const quality = String(
    stream.quality || ""
  ).toLowerCase();

  // Jangan pernah memilih stream yang jelas audio-only.
  if (
    mime.includes("audio/") ||
    mime.includes("audio") ||
    url.includes(".mp3") ||
    url.includes(".aac") ||
    url.includes(".m4a") ||
    url.includes(".opus") ||
    url.includes(".weba")
  ) {
    return false;
  }

  // Prioritas stream video.
  if (
    url.includes(".m3u8") ||
    url.includes(".mp4") ||
    mime.includes("video/") ||
    mime.includes("mpegurl") ||
    mime.includes("m3u8") ||
    resolution.includes("x") ||
    /\d+p/i.test(quality)
  ) {
    return true;
  }

  return false;
}

function makeProxyUrl(
  url: string,
  headers: Record<string, string>
) {
  return (
    "/api/meloshort/stream?url=" +
    encodeURIComponent(url) +
    "&headers=" +
    encodeURIComponent(JSON.stringify(headers))
  );
}

function makeSubtitleProxyUrl(
  url: string,
  headers: Record<string, string>
) {
  return (
    "/api/meloshort/stream?subtitle=1&url=" +
    encodeURIComponent(url) +
    "&headers=" +
    encodeURIComponent(JSON.stringify(headers))
  );
}

export default function WatchMeloShortPage() {
  const params = useParams();
  const router = useRouter();

  const bookId = String(params.bookId || "");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [cover, setCover] = useState("");
  const [dramaTitle, setDramaTitle] = useState("");

  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState("");
  const [episodeLoading, setEpisodeLoading] =
    useState(true);

  const [subtitles, setSubtitles] = useState<
    Subtitle[]
  >([]);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentEpisode = episodes[currentIndex];

  const currentEpisodeId = useMemo(() => {
    if (!currentEpisode) return "";

    return getEpisodeId(currentEpisode);
  }, [currentEpisode]);

  /*
   * Bersihkan HLS sepenuhnya.
   */
  const destroyHls = useCallback(() => {
    try {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    } catch (error) {
      console.warn(
        "Gagal destroy HLS:",
        error
      );

      hlsRef.current = null;
    }
  }, []);

  /*
   * Ambil detail drama.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      try {
        setEpisodeLoading(true);

        const response = await fetch(
          `/api/meloshort?path=/api/v2/detail&id=${encodeURIComponent(
            bookId
          )}&lang=id`,
          {
            cache: "no-store",
          }
        );

        const json: DetailResponse =
          await response.json();

        if (cancelled) return;

        console.log(
          "========== MELOSHORT DETAIL ==========",
          json
        );

        const data = json?.data || {};

        const list =
          data.episodes ||
          data.chapters ||
          data.chapterList ||
          data.videoList ||
          data.list ||
          [];

        const normalizedEpisodes =
          Array.isArray(list)
            ? list
            : [];

        setEpisodes(normalizedEpisodes);

        setCover(
          data.coverWap ||
            data.cover ||
            data.coverUrl ||
            data.poster ||
            ""
        );

        setDramaTitle(
          data.bookName ||
            data.title ||
            data.name ||
            ""
        );

        setEpisodeLoading(false);
      } catch (error: any) {
        console.error(
          "MELOSHORT DETAIL ERROR:",
          error
        );

        if (!cancelled) {
          setVideoError(
            error?.message ||
              "Gagal mengambil daftar episode."
          );

          setEpisodeLoading(false);
        }
      }
    }

    if (bookId) {
      loadDetail();
    }

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  /*
   * Ambil video + subtitle setiap kali episode berubah.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadVideo() {
      if (!bookId || !currentEpisodeId) {
        return;
      }

      setVideoLoading(true);
      setVideoError("");
      setSubtitles([]);

      destroyHls();

      const video = videoRef.current;

      if (video) {
        try {
          video.pause();
        } catch {}

        video.removeAttribute("src");
        video.load();
      }

      try {
        const response = await fetch(
          `/api/meloshort?path=/api/v2/video&id=${encodeURIComponent(
            bookId
          )}&chapterId=${encodeURIComponent(
            currentEpisodeId
          )}&lang=id`,
          {
            cache: "no-store",
          }
        );

        const json: VideoResponse =
          await response.json();

        if (cancelled) return;

        console.log(
          "========== MELOSHORT VIDEO RAW ==========",
          JSON.stringify(json, null, 2)
        );

        const videoData = json?.data;

        if (!videoData) {
          throw new Error(
            "Data video tidak ditemukan."
          );
        }

        /*
         * SUBTITLE
         */
        const subtitleList = Array.isArray(
          videoData.subtitles
        )
          ? videoData.subtitles.filter(
              (item) =>
                item &&
                typeof item.url === "string" &&
                item.url.trim()
            )
          : [];

        setSubtitles(subtitleList);

        /*
         * STREAM
         */
        const streams = Array.isArray(
          videoData.streams
        )
          ? videoData.streams
          : [];

        console.log(
          "MELOSHORT STREAMS:",
          streams
        );

        const videoStreams =
          streams.filter(
            isProbablyVideoStream
          );

        if (!videoStreams.length) {
          throw new Error(
            "API tidak mengembalikan stream video."
          );
        }

        /*
         * Prioritas:
         * 1. m3u8
         * 2. resolusi tertinggi
         * 3. kualitas tertinggi
         */
        const sortedStreams = [
          ...videoStreams,
        ].sort((a, b) => {
          const aM3u8 = String(
            a.url || ""
          )
            .toLowerCase()
            .includes(".m3u8");

          const bM3u8 = String(
            b.url || ""
          )
            .toLowerCase()
            .includes(".m3u8");

          if (aM3u8 !== bM3u8) {
            return aM3u8 ? -1 : 1;
          }

          const parseResolution = (
            value: string
          ) => {
            const match =
              value.match(
                /(\d{3,5})x(\d{3,5})/
              );

            if (!match) return 0;

            return (
              Number(match[1]) *
              Number(match[2])
            );
          };

          const aRes =
            parseResolution(
              String(
                a.resolution || ""
              )
            );

          const bRes =
            parseResolution(
              String(
                b.resolution || ""
              )
            );

          return bRes - aRes;
        });

        const selectedStream =
          sortedStreams[0];

        const originalUrl = String(
          selectedStream.url || ""
        );

        if (!originalUrl) {
          throw new Error(
            "URL stream kosong."
          );
        }

        const streamHeaders =
          getStreamHeaders(
            selectedStream,
            videoData
          );

        const proxiedUrl =
          makeProxyUrl(
            originalUrl,
            streamHeaders
          );

        console.log(
          "SELECTED VIDEO STREAM:",
          selectedStream
        );

        console.log(
          "PROXIED VIDEO URL:",
          proxiedUrl
        );

        if (cancelled) return;

        const videoElement =
          videoRef.current;

        if (!videoElement) {
          throw new Error(
            "Video element belum tersedia."
          );
        }

        /*
         * Kalau MP4 langsung, browser bisa play.
         */
        const isM3u8 =
          originalUrl
            .toLowerCase()
            .includes(".m3u8");

        if (!isM3u8) {
          videoElement.src = proxiedUrl;
          videoElement.load();

          try {
            await videoElement.play();
          } catch {}

          if (!cancelled) {
            setVideoLoading(false);
          }

          return;
        }

        /*
         * HLS
         */
        const nativeHls =
          videoElement.canPlayType(
            "application/vnd.apple.mpegurl"
          );

        /*
         * Safari/iOS biasanya bisa native HLS.
         */
        if (nativeHls) {
          videoElement.src =
            proxiedUrl;

          videoElement.load();

          const onLoaded = async () => {
            try {
              await videoElement.play();
            } catch {}

            if (!cancelled) {
              setVideoLoading(false);
            }
          };

          videoElement.addEventListener(
            "loadedmetadata",
            onLoaded,
            { once: true }
          );

          return;
        }

        /*
         * Chrome/Android/Desktop:
         * gunakan HLS.js.
         */
        const HlsModule =
          await import("hls.js");

        if (cancelled) return;

        const Hls =
          HlsModule.default;

        if (!Hls.isSupported()) {
          /*
           * Jangan memaksa fallback aneh.
           * Kalau browser memang tidak support HLS,
           * baru coba src langsung.
           */
          videoElement.src =
            proxiedUrl;

          videoElement.load();

          try {
            await videoElement.play();
          } catch {}

          if (!cancelled) {
            setVideoLoading(false);
          }

          return;
        }

        const hls = new Hls({
          enableWorker: true,

          /*
           * Penting untuk playlist MeloShort
           * yang kadang mempunyai master/variant
           * playlist berbeda antar episode.
           */
          lowLatencyMode: false,

          /*
           * Biarkan HLS memilih level video.
           */
          startLevel: -1,

          /*
           * Jangan batasi resolusi berdasarkan
           * ukuran container.
           */
          capLevelToPlayerSize: false,

          /*
           * Recovery kalau manifest/segment
           * mengalami error sementara.
           */
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 3,
          fragLoadingMaxRetry: 3,

          manifestLoadingRetryDelay: 1000,
          levelLoadingRetryDelay: 1000,
          fragLoadingRetryDelay: 1000,

          maxBufferLength: 30,
          backBufferLength: 30,
        });

        hlsRef.current = hls;

        hls.attachMedia(
          videoElement
        );

        hls.on(
          Hls.Events.MEDIA_ATTACHED,
          () => {
            if (cancelled) return;

            console.log(
              "HLS MEDIA ATTACHED"
            );

            hls.loadSource(
              proxiedUrl
            );
          }
        );

        hls.on(
          Hls.Events.MANIFEST_PARSED,
          async (_event: any, data: any) => {
            if (cancelled) return;

            console.log(
              "HLS MANIFEST PARSED:",
              data
            );

            /*
             * Pastikan player memilih
             * level yang memiliki video.
             */
            const levels =
              hls.levels || [];

            console.log(
              "HLS LEVELS:",
              levels.map(
                (level: any) => ({
                  width:
                    level.width,
                  height:
                    level.height,
                  bitrate:
                    level.bitrate,
                  codecs:
                    level.codecs,
                })
              )
            );

            /*
             * Pilih level tertinggi yang
             * benar-benar memiliki dimensi video.
             */
            const videoLevels =
              levels
                .map(
                  (
                    level: any,
                    index: number
                  ) => ({
                    level,
                    index,
                  })
                )
                .filter(
                  ({
                    level,
                  }: any) =>
                    Number(
                      level.width
                    ) > 0 &&
                    Number(
                      level.height
                    ) > 0
                );

            if (
              videoLevels.length
            ) {
              const highest =
                videoLevels.sort(
                  (a: any, b: any) =>
                    b.level.width *
                      b.level.height -
                    a.level.width *
                      a.level.height
                )[0];

              hls.currentLevel =
                highest.index;

              console.log(
                "HLS SELECTED VIDEO LEVEL:",
                highest.level
              );
            }

            try {
              await videoElement.play();
            } catch (error) {
              console.log(
                "Autoplay diblokir browser:",
                error
              );
            }

            if (!cancelled) {
              setVideoLoading(false);
            }
          }
        );

        hls.on(
          Hls.Events.ERROR,
          (
            _event: any,
            data: any
          ) => {
            console.error(
              "========== HLS ERROR ==========",
              data
            );

            if (
              data?.fatal
            ) {
              if (
                data.type ===
                Hls.ErrorTypes.NETWORK_ERROR
              ) {
                console.warn(
                  "HLS network error, mencoba recover..."
                );

                try {
                  hls.startLoad();
                } catch {}
              } else if (
                data.type ===
                Hls.ErrorTypes.MEDIA_ERROR
              ) {
                console.warn(
                  "HLS media error, mencoba recover..."
                );

                try {
                  hls.recoverMediaError();
                } catch {}
              } else {
                setVideoError(
                  "Stream video episode ini gagal diputar. Cek console untuk detail HLS."
                );

                try {
                  hls.destroy();
                } catch {}

                hlsRef.current =
                  null;
              }
            }
          }
        );
      } catch (error: any) {
        console.error(
          "MELOSHORT VIDEO ERROR:",
          error
        );

        if (!cancelled) {
          setVideoError(
            error?.message ||
              "Gagal memuat video."
          );

          setVideoLoading(false);
        }
      }
    }

    loadVideo();

    return () => {
      cancelled = true;
      destroyHls();
    };
  }, [
    bookId,
    currentEpisodeId,
    destroyHls,
  ]);

  /*
   * Cleanup ketika meninggalkan halaman.
   */
  useEffect(() => {
    return () => {
      destroyHls();
    };
  }, [destroyHls]);

  const selectEpisode = (
    index: number
  ) => {
    if (
      index < 0 ||
      index >= episodes.length
    ) {
      return;
    }

    destroyHls();

    setCurrentIndex(index);
    setDrawerOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const previousEpisode = () => {
    if (currentIndex > 0) {
      selectEpisode(
        currentIndex - 1
      );
    }
  };

  const nextEpisode = () => {
    if (
      currentIndex <
      episodes.length - 1
    ) {
      selectEpisode(
        currentIndex + 1
      );
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/10 bg-black/95 px-4 backdrop-blur">
        <button
          onClick={() =>
            router.push("/")
          }
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <span className="text-lg">
            ←
          </span>

          <span>TPLAY</span>
        </button>

        <button
          onClick={() =>
            setDrawerOpen(true)
          }
          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold transition hover:bg-white/20"
        >
          ☰ Episode
        </button>
      </header>

      {/* PLAYER */}
      <section className="w-full bg-black">
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={cover || undefined}
            className="h-full w-full bg-black object-contain"
          >
            {subtitles.map(
              (
                subtitle,
                index
              ) => {
                const headers =
                  {};

                const src =
                  makeSubtitleProxyUrl(
                    subtitle.url,
                    headers
                  );

                const languageCode =
                  subtitle.languageCode ||
                  `sub${index}`;

                const label =
                  subtitle.language ||
                  subtitle.label ||
                  subtitle.languageCode ||
                  `Subtitle ${index + 1}`;

                return (
                  <track
                    key={`${subtitle.url}-${index}`}
                    kind="subtitles"
                    src={src}
                    srcLang={
                      languageCode
                    }
                    label={label}
                    default={
                      index === 0
                    }
                  />
                );
              }
            )}
          </video>

          {videoLoading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />

                <span className="text-xs text-white/70">
                  Memuat video...
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* INFO */}
      <section className="border-b border-white/10 bg-zinc-950 px-4 py-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start gap-3">
            {cover && (
              <img
                src={cover}
                alt={dramaTitle}
                className="h-20 w-14 rounded-md object-cover"
              />
            )}

            <div className="min-w-0 flex-1">
              <h1 className="line-clamp-2 text-base font-bold">
                {dramaTitle ||
                  "TPLAY"}
              </h1>

              <p className="mt-1 text-xs text-white/50">
                {currentEpisode
                  ? getEpisodeTitle(
                      currentEpisode,
                      currentIndex
                    )
                  : "Memuat episode..."}
              </p>

              {subtitles.length >
                0 && (
                <p className="mt-2 text-[11px] text-white/40">
                  CC tersedia ·{" "}
                  {subtitles
                    .map(
                      (item) =>
                        item.language ||
                        item.languageCode
                    )
                    .join(", ")}
                </p>
              )}
            </div>
          </div>

          {videoError && (
            <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {videoError}
            </div>
          )}

          {/* PREV NEXT */}
          <div className="mt-4 flex gap-2">
            <button
              disabled={
                currentIndex <= 0
              }
              onClick={
                previousEpisode
              }
              className="flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Sebelumnya
            </button>

            <button
              disabled={
                currentIndex >=
                episodes.length - 1
              }
              onClick={nextEpisode}
              className="flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-30"
            >
              Berikutnya →
            </button>
          </div>

          <button
            onClick={() =>
              setDrawerOpen(true)
            }
            className="mt-2 w-full rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-black"
          >
            ☰ Pilih Episode
          </button>
        </div>
      </section>

      {/* EPISODE DRAWER */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/70"
          onClick={() =>
            setDrawerOpen(false)
          }
        >
          <aside
            className="absolute right-0 top-0 h-full w-[88%] max-w-md overflow-y-auto border-l border-white/10 bg-zinc-950 p-4 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Episode
                </h2>

                <p className="text-xs text-white/40">
                  {episodes.length} episode
                </p>
              </div>

              <button
                onClick={() =>
                  setDrawerOpen(false)
                }
                className="rounded-full bg-white/10 px-3 py-2 text-sm"
              >
                ✕
              </button>
            </div>

            {episodeLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            ) : episodes.length ===
              0 ? (
              <div className="py-10 text-center text-sm text-white/40">
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
                      currentIndex;

                    return (
                      <button
                        key={`${getEpisodeId(
                          episode
                        )}-${index}`}
                        onClick={() =>
                          selectEpisode(
                            index
                          )
                        }
                        className={`rounded-lg px-2 py-3 text-xs font-semibold transition ${
                          active
                            ? "bg-white text-black"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {getEpisodeTitle(
                          episode,
                          index
                        ).replace(
                          /^Episode\s*/i,
                          "EP "
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
