"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWatchHistoryStore } from "@/hooks/useWatchHistory";

interface Episode {
  id?: string | number;
  chapter_id?: string | number;
  chapterId?: string | number;
  title?: string;
  name?: string;
  episode?: number;
  episode_index?: number;
  index?: number;
  [key: string]: any;
}

interface Stream {
  quality?: string;
  resolution?: string;
  url?: string;
  [key: string]: any;
}

interface Subtitle {
  language?: string;
  languageCode?: string;
  format?: string;
  url?: string;
  [key: string]: any;
}

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

interface DramaMetadata {
  title: string;
  image: string;
  totalEpisodes: number;
}

const WORKER_PROXY =
  "https://tplay-proxy.3twidy.workers.dev/?url=";

function proxyUrl(url: string) {
  return WORKER_PROXY + encodeURIComponent(url);
}

/*
 * MeloShort subtitle dibuat sebagai overlay HTML sendiri.
 *
 * Beberapa browser/tablet tidak konsisten menampilkan <track>
 * subtitle pada video HLS. Dengan overlay ini subtitle tetap
 * terlihat di atas video seperti hard-sub, tetapi file video
 * aslinya tidak perlu diubah/transcode.
 */
function subtitleProxyUrl(url: string) {
  return (
    "/api/meloshort/stream?url=" +
    encodeURIComponent(url) +
    "&subtitle=1"
  );
}

function parseVttTimestamp(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");

  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);

    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      Number.isFinite(seconds)
    ) {
      return hours * 3600 + minutes * 60 + seconds;
    }
  }

  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);

    if (
      Number.isFinite(minutes) &&
      Number.isFinite(seconds)
    ) {
      return minutes * 60 + seconds;
    }
  }

  return NaN;
}

function parseSubtitleCues(text: string): SubtitleCue[] {
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .trim();

  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trimEnd());

    const timingIndex = lines.findIndex((line) =>
      /(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}/.test(
        line
      )
    );

    if (timingIndex < 0) continue;

    const timing = lines[timingIndex];
    const match = timing.match(
      /((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})/
    );

    if (!match) continue;

    const start = parseVttTimestamp(match[1]);
    const end = parseVttTimestamp(match[2]);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }

    const cueText = lines
      .slice(timingIndex + 1)
      .join("\n")
      .replace(/<br\s*\/?>(?=\S)/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!cueText) continue;

    cues.push({
      start,
      end,
      text: cueText,
    });
  }

  return cues;
}

function getActiveSubtitle(
  cues: SubtitleCue[],
  currentTime: number
) {
  if (!cues.length) return "";

  /*
   * Binary search supaya tetap ringan walaupun subtitle
   * memiliki banyak cue.
   */
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cue = cues[mid];

    if (currentTime < cue.start) {
      high = mid - 1;
    } else if (currentTime > cue.end) {
      low = mid + 1;
    } else {
      return cue.text;
    }
  }

  return "";
}

function getChapterId(
  episode: Episode,
  fallbackIndex: number
) {
  return (
    episode.id ??
    episode.chapterId ??
    episode.chapter_id ??
    episode.episode ??
    fallbackIndex + 1
  );
}

function getEpisodeNumber(
  episode: Episode,
  index: number
) {
  return (
    episode.episode ??
    episode.episode_index ??
    episode.index ??
    index + 1
  );
}

function getEpisodeTitle(
  episode: Episode,
  index: number
) {
  const number = getEpisodeNumber(episode, index);

  return (
    episode.title ||
    episode.name ||
    `Episode ${number}`
  );
}

function findIndonesiaSubtitle(
  subtitles: Subtitle[]
): Subtitle | undefined {
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return undefined;
  }

  const exactCode = subtitles.find(
    (subtitle) =>
      String(subtitle?.languageCode || "")
        .trim()
        .toLowerCase() === "id"
  );

  if (exactCode?.url) {
    return exactCode;
  }

  const indonesia = subtitles.find((subtitle) => {
    const language = String(
      subtitle?.language || ""
    ).toLowerCase();

    const code = String(
      subtitle?.languageCode || ""
    ).toLowerCase();

    return (
      language.includes("indonesia") ||
      language.includes("bahasa indonesia") ||
      code === "id-id" ||
      code.startsWith("id-")
    );
  });

  if (indonesia?.url) {
    return indonesia;
  }

  const ind = subtitles.find((subtitle) => {
    const language = String(
      subtitle?.language || ""
    ).toLowerCase();

    const code = String(
      subtitle?.languageCode || ""
    ).toLowerCase();

    return (
      language === "ind" ||
      language.startsWith("ind ") ||
      code === "ind"
    );
  });

  if (ind?.url) {
    return ind;
  }

  return subtitles.find(
    (subtitle) => !!subtitle?.url
  );
}

/*
 * Tunggu sebentar tanpa membuat request beruntun.
 */
function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function cleanText(value: any): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = cleanText(item);

      if (text) {
        return text;
      }
    }
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const preferredKeys = [
      "id",
      "ID",
      "value",
      "text",
      "name",
      "title",
      "content",
    ];

    for (const key of preferredKeys) {
      const text = cleanText(value?.[key]);

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function pickDramaText(
  item: any,
  fields: string[],
  fallback = ""
): string {
  for (const field of fields) {
    const value = item?.[field];

    if (Array.isArray(value)) {
      for (const candidate of value) {
        const text = cleanText(candidate);

        if (text) {
          return text;
        }
      }
    }

    const text = cleanText(value);

    if (text) {
      return text;
    }
  }

  return fallback;
}

function pickDramaCover(item: any): string {
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

export default function WatchPage() {
  const params = useParams();

  const bookId = String(
    params.bookId || ""
  );

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const hlsRef = useRef<any>(null);

  const requestIdRef =
    useRef(0);

  const mountedRef =
    useRef(true);

  /*
   * Menyimpan daftar episode terbaru tanpa membuat
   * callback playEpisode berubah setiap setEpisodes().
   */
  const episodesRef =
    useRef<Episode[]>([]);

  /*
   * Metadata drama disimpan di ref supaya playEpisode()
   * selalu bisa memperbarui Watch History tanpa request
   * detail API tambahan.
   */
  const dramaMetadataRef =
    useRef<DramaMetadata>({
      title: "Drama Pilihan",
      image: "",
      totalEpisodes: 0,
    });

  /*
   * Batalkan request Video API sebelumnya ketika
   * user berpindah episode.
   */
  const videoAbortRef =
    useRef<AbortController | null>(null);

  /*
   * Timestamp request terakhir.
   * Membantu mencegah request video terlalu rapat.
   */
  const lastVideoRequestRef =
    useRef(0);

  const [episodes, setEpisodes] =
    useState<Episode[]>([]);

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [playing, setPlaying] =
    useState(false);

  const [subtitleText, setSubtitleText] =
    useState("");

  const subtitleCuesRef =
    useRef<SubtitleCue[]>([]);

  const [error, setError] =
    useState("");

  // =========================================================
  // DESTROY PLAYER
  // =========================================================

  const destroyPlayer = useCallback(() => {
    const hls = hlsRef.current;

    if (hls) {
      try {
        hls.stopLoad();
      } catch {}

      try {
        hls.detachMedia();
      } catch {}

      try {
        hls.destroy();
      } catch {}

      hlsRef.current = null;
    }

    const video = videoRef.current;

    if (!video) return;

    try {
      video.pause();
    } catch {}

    video.onplaying = null;
    video.onwaiting = null;
    video.oncanplay = null;
    video.onloadeddata = null;
    video.onerror = null;

    try {
      video.removeAttribute("src");
    } catch {}

    try {
      video.load();
    } catch {}

    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }

    subtitleCuesRef.current = [];
    setSubtitleText("");
  }, []);

  // =========================================================
  // PLAY STREAM
  // =========================================================

  const playStream = useCallback(
    async (
      originalUrl: string,
      subtitleUrl?: string
    ) => {
      const video =
        videoRef.current;

      if (!video) {
        throw new Error(
          "Player belum siap."
        );
      }

      const localRequestId =
        requestIdRef.current;

      destroyPlayer();

      if (!mountedRef.current) return;

      setError("");
      setLoading(true);
      setPlaying(false);

      const playableUrl =
        proxyUrl(originalUrl);

      // =======================================================
      // SUBTITLE INDONESIA — HARD-SUB STYLE OVERLAY
      // =======================================================

      subtitleCuesRef.current = [];
      setSubtitleText("");

      if (subtitleUrl) {
        try {
          const subtitleResponse =
            await fetch(
              subtitleProxyUrl(subtitleUrl),
              {
                cache: "no-store",
              }
            );

          if (subtitleResponse.ok) {
            const subtitleContent =
              await subtitleResponse.text();

            const cues =
              parseSubtitleCues(
                subtitleContent
              );

            if (localRequestId === requestIdRef.current) {
              subtitleCuesRef.current = cues;
            }
          }
        } catch (subtitleError) {
          /*
           * Subtitle tidak boleh membuat video gagal.
           * Jika subtitle provider tertentu tidak bisa diambil,
           * video tetap diputar tanpa subtitle.
           */
          console.warn(
            "MeloShort subtitle overlay gagal dimuat:",
            subtitleError
          );
        }
      }

      // =======================================================
      // VIDEO EVENTS
      // =======================================================

      video.onplaying = () => {
        if (
          localRequestId !==
          requestIdRef.current
        ) {
          return;
        }

        if (!mountedRef.current) return;

        setPlaying(true);
        setLoading(false);
        setError("");
      };

      video.onwaiting = () => {
        if (
          localRequestId !==
          requestIdRef.current
        ) {
          return;
        }

        if (!mountedRef.current) return;

        // Normal HLS.js buffer refills should not flash the loader.
        if (
          video.currentTime <= 0 &&
          video.paused
        ) {
          setLoading(true);
        }
      };

      video.oncanplay = () => {
        if (
          localRequestId !==
          requestIdRef.current
        ) {
          return;
        }

        if (!mountedRef.current) return;

        if (!video.paused) {
          setLoading(false);
        }
      };

      video.onloadeddata = () => {
        if (
          localRequestId !==
          requestIdRef.current
        ) {
          return;
        }

        if (!mountedRef.current) return;

        if (!video.paused) {
          setLoading(false);
        }
      };

      video.ontimeupdate = () => {
        if (
          localRequestId !==
          requestIdRef.current
        ) {
          return;
        }

        setSubtitleText(
          getActiveSubtitle(
            subtitleCuesRef.current,
            video.currentTime
          )
        );
      };

      // =======================================================
      // HLS.JS
      // =======================================================

      try {
        const HlsModule =
          await import("hls.js");

        const Hls =
          HlsModule.default;

        if (
          localRequestId !==
          requestIdRef.current
        ) {
          return;
        }

        if (
          Hls &&
          Hls.isSupported() &&
          /\.m3u8(\?|$)/i.test(
            originalUrl
          )
        ) {
          const hls =
            new Hls({
              enableWorker: true,

              maxBufferLength: 30,
              maxMaxBufferLength: 60,

              backBufferLength: 90,

              lowLatencyMode: false,

              /*
               * Jangan terlalu agresif retry.
               * Retry HLS berbeda dengan retry Video API.
               */
              fragLoadingMaxRetry: 3,
              manifestLoadingMaxRetry: 3,
              levelLoadingMaxRetry: 3,

              fragLoadingRetryDelay: 1500,
              manifestLoadingRetryDelay: 1500,
              levelLoadingRetryDelay: 1500,
            });

          hlsRef.current =
            hls;

          hls.on(
            Hls.Events.MANIFEST_PARSED,
            () => {
              if (
                localRequestId !==
                requestIdRef.current
              ) {
                return;
              }

              if (!mountedRef.current) {
                return;
              }

              video
                .play()
                .then(() => {
                  if (
                    localRequestId ===
                    requestIdRef.current
                  ) {
                    setLoading(false);
                  }
                })
                .catch(() => {});
            }
          );

          hls.on(
            Hls.Events.ERROR,
            (
              _event: any,
              data: any
            ) => {
              if (
                localRequestId !==
                requestIdRef.current
              ) {
                return;
              }

              if (!data?.fatal) {
                return;
              }

              if (
                data.type ===
                Hls.ErrorTypes.NETWORK_ERROR
              ) {
                try {
                  hls.startLoad();
                } catch {}

                return;
              }

              if (
                data.type ===
                Hls.ErrorTypes.MEDIA_ERROR
              ) {
                try {
                  hls.recoverMediaError();
                } catch {}

                return;
              }

              try {
                hls.destroy();
              } catch {}

              if (
                hlsRef.current === hls
              ) {
                hlsRef.current =
                  null;
              }

              if (
                localRequestId !==
                requestIdRef.current
              ) {
                return;
              }

              try {
                video.src =
                  playableUrl;

                video.load();

                video
                  .play()
                  .catch(() => {});
              } catch {}
            }
          );

          hls.loadSource(
            playableUrl
          );

          hls.attachMedia(
            video
          );

          return;
        }
      } catch (err) {
        console.warn(
          "HLS.js gagal dimuat:",
          err
        );
      }

      // =======================================================
      // NATIVE FALLBACK
      // =======================================================

      if (
        localRequestId !==
        requestIdRef.current
      ) {
        return;
      }

      video.src =
        playableUrl;

      video.load();

      video
        .play()
        .then(() => {
          if (
            localRequestId ===
              requestIdRef.current &&
            mountedRef.current
          ) {
            setLoading(false);
          }
        })
        .catch(() => {});
    },
    [destroyPlayer]
  );

  // =========================================================
  // LOAD DETAIL
  // =========================================================

  const loadDetail =
    useCallback(async () => {
      const response =
        await fetch(
          `/api/meloshort?path=/api/v2/detail` +
            `&category_p=meloshort` +
            `&id=${encodeURIComponent(
              bookId
            )}` +
            `&lang=id`,
          {
            cache: "no-store",
          }
        );

      if (!response.ok) {
        throw new Error(
          `Detail API ${response.status}`
        );
      }

      const json =
        await response.json();

      const data =
        json?.data ||
        json;

      const list =
        data?.chapters ||
        data?.episodes ||
        data?.list ||
        [];

      if (
        !Array.isArray(list) ||
        list.length === 0
      ) {
        throw new Error(
          "Episode tidak ditemukan."
        );
      }

      const title = pickDramaText(
        data,
        [
          "bookName",
          "book_name",
          "title",
          "name",
          "bookTitle",
          "book_title",
        ],
        "Drama Pilihan"
      );

      const image = pickDramaCover(data);

      return {
        episodes: list as Episode[],
        metadata: {
          title,
          image,
          totalEpisodes: list.length,
        },
      };
    }, [bookId]);

  // =========================================================
  // PLAY EPISODE
  // =========================================================

  const playEpisode =
    useCallback(
      async (
        index: number,
        overrideEpisodes?: Episode[]
      ) => {
        const list =
          overrideEpisodes ||
          episodesRef.current;

        const episode =
          list[index];

        if (!episode) return;

        /*
         * Request lama langsung dibatalkan.
         */
        if (videoAbortRef.current) {
          try {
            videoAbortRef.current.abort();
          } catch {}
        }

        const abortController =
          new AbortController();

        videoAbortRef.current =
          abortController;

        /*
         * Request ID baru.
         */
        const requestId =
          ++requestIdRef.current;

        setCurrentIndex(index);

        /*
         * FIX HISTORY:
         * Simpan episode aktif ke URL.
         *
         * Header membaca URL ini untuk mengetahui
         * episode yang sedang ditonton.
         */
        if (typeof window !== "undefined") {
          const currentUrl =
            new URL(
              window.location.href
            );

          currentUrl.searchParams.set(
            "episode",
            String(index + 1)
          );

          window.history.replaceState(
            window.history.state,
            "",
            currentUrl.toString()
          );
        }

        /*
         * FIX WATCH HISTORY:
         * MeloShort memakai currentIndex + query parameter,
         * sehingga Header tidak akan terpicu ulang saat episode
         * berubah. Simpan langsung ke store setiap kali episode
         * dimainkan agar judul dan nomor episode selalu benar.
         */
        const historyUrl =
          typeof window !== "undefined"
            ? window.location.href
            : `/watch/meloshort/${bookId}?episode=${index + 1}`;

        const metadata =
          dramaMetadataRef.current;

        useWatchHistoryStore
          .getState()
          .addItem({
            id: `meloshort-${bookId}`,
            title:
              metadata.title ||
              "Drama Pilihan",
            image:
              metadata.image ||
              "",
            platform: "MeloShort",
            timestamp: Date.now(),
            url: historyUrl,
            episode: index + 1,
            totalEpisodes:
              metadata.totalEpisodes ||
              list.length,
          });

        setError("");
        setLoading(true);
        setPlaying(false);

        try {
          const chapterId =
            getChapterId(
              episode,
              index
            );

          /*
           * Pastikan request Video API tidak ditembak
           * terlalu rapat.
           */
          const elapsed =
            Date.now() -
            lastVideoRequestRef.current;

          const minimumGap = 700;

          if (
            elapsed <
            minimumGap
          ) {
            await sleep(
              minimumGap - elapsed
            );
          }

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          lastVideoRequestRef.current =
            Date.now();

          const videoApiUrl =
            `/api/meloshort?path=/api/v2/video` +
            `&category_p=meloshort` +
            `&id=${encodeURIComponent(
              bookId
            )}` +
            `&chapterId=${encodeURIComponent(
              String(chapterId)
            )}` +
            `&lang=id`;

          let response =
            await fetch(
              videoApiUrl,
              {
                cache: "no-store",
                signal:
                  abortController.signal,
              }
            );

          /*
           * ===================================================
           * QUICKPLAY 429
           * ===================================================
           *
           * Jangan langsung menembak ulang berkali-kali.
           *
           * Coba sekali setelah jeda.
           */
          if (
            response.status === 429
          ) {
            console.warn(
              "QuickPlay Video API 429. Menunggu sebelum retry..."
            );

            const retryAfter =
              Number(
                response.headers.get(
                  "Retry-After"
                )
              );

            const waitTime =
              Number.isFinite(
                retryAfter
              ) &&
              retryAfter > 0
                ? Math.min(
                    retryAfter * 1000,
                    8000
                  )
                : 2500;

            await sleep(
              waitTime
            );

            if (
              requestId !==
                requestIdRef.current ||
              abortController.signal
                .aborted
            ) {
              return;
            }

            lastVideoRequestRef.current =
              Date.now();

            response =
              await fetch(
                videoApiUrl,
                {
                  cache: "no-store",
                  signal:
                    abortController.signal,
                }
              );
          }

          if (
            !response.ok
          ) {
            if (
              response.status ===
              429
            ) {
              throw new Error(
                "Video API sedang membatasi request. Tunggu beberapa detik lalu coba lagi."
              );
            }

            throw new Error(
              `Video API ${response.status}`
            );
          }

          const json =
            await response.json();

          /*
           * Abaikan response lama.
           */
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          const data =
            json?.data ||
            json;

          const streams =
            data?.streams ||
            data?.urls ||
            [];

          if (
            !Array.isArray(
              streams
            ) ||
            streams.length === 0
          ) {
            throw new Error(
              "Stream video tidak tersedia."
            );
          }

          /*
           * Prioritas:
           * 1080p → 720p → 480p → pertama.
           */
          const stream =
            streams.find(
              (x: Stream) =>
                /1080/i.test(
                  String(
                    x?.quality ||
                      x?.resolution ||
                      ""
                  )
                )
            ) ||
            streams.find(
              (x: Stream) =>
                /720/i.test(
                  String(
                    x?.quality ||
                      x?.resolution ||
                      ""
                  )
                )
            ) ||
            streams.find(
              (x: Stream) =>
                /480/i.test(
                  String(
                    x?.quality ||
                      x?.resolution ||
                      ""
                  )
                )
            ) ||
            streams[0];

          if (!stream?.url) {
            throw new Error(
              "URL video tidak ditemukan."
            );
          }

          // ===================================================
          // SUBTITLE INDONESIA
          // ===================================================

          const subtitles =
            Array.isArray(
              data?.subtitles
            )
              ? data.subtitles
              : Array.isArray(
                  data?.subs
                )
              ? data.subs
              : [];

          const indonesia =
            findIndonesiaSubtitle(
              subtitles
            );

          const subtitleUrl =
            indonesia?.url ||
            "";

          await playStream(
            stream.url,
            subtitleUrl
          );

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          setDrawerOpen(false);
        } catch (err: any) {
          /*
           * Abort bukan error player.
           */
          if (
            err?.name ===
            "AbortError"
          ) {
            return;
          }

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          console.error(
            "PLAY EPISODE ERROR:",
            err
          );

          setLoading(false);

          setError(
            err?.message ||
              "Gagal memutar video."
          );
        }
      },
      [
        bookId,
        playStream,
      ]
    );

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    mountedRef.current =
      true;

    let cancelled =
      false;

    async function start() {
      try {
        setLoading(true);
        setError("");

        const detail =
          await loadDetail();

        if (
          cancelled ||
          !mountedRef.current
        ) {
          return;
        }

        const list =
          detail.episodes;

        dramaMetadataRef.current =
          detail.metadata;

        /*
         * Simpan ke state dan ref.
         *
         * Ref penting supaya perubahan state episodes
         * tidak menyebabkan useEffect awal menembak
         * ulang Video API.
         */
        episodesRef.current =
          list;

        setEpisodes(list);

        const searchParams =
          new URLSearchParams(
            window.location.search
          );

        const requested =
          Number(
            searchParams.get(
              "episode"
            ) || "1"
          );

        let index =
          Number.isFinite(
            requested
          )
            ? requested - 1
            : 0;

        if (index < 0) {
          index = 0;
        }

        if (
          index >= list.length
        ) {
          index = 0;
        }

        /*
         * Hanya satu pemanggilan episode awal.
         */
        await playEpisode(
          index,
          list
        );
      } catch (err: any) {
        if (
          cancelled ||
          !mountedRef.current
        ) {
          return;
        }

        if (
          err?.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "INITIAL ERROR:",
          err
        );

        setLoading(false);

        setError(
          err?.message ||
            "Gagal memuat drama."
        );
      }
    }

    if (bookId) {
      start();
    }

    return () => {
      cancelled = true;

      mountedRef.current =
        false;

      requestIdRef.current++;

      if (videoAbortRef.current) {
        try {
          videoAbortRef.current.abort();
        } catch {}
      }

      destroyPlayer();
    };
  }, [
    bookId,
    loadDetail,
    playEpisode,
    destroyPlayer,
  ]);

  // =========================================================
  // AUTO NEXT
  // =========================================================

  const handleEnded =
    useCallback(() => {
      const next =
        currentIndex + 1;

      if (
        next < episodesRef.current.length
      ) {
        playEpisode(next);
      }
    }, [currentIndex, playEpisode]);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="watchPage">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="topHeader">
        <Link
          href="/"
          className="brand"
        >
          <span className="brandIcon">
            ▶
          </span>

          <span>TPLAY</span>
        </Link>

        <Link
          href="/"
          className="homeButton"
        >
          Home
        </Link>
      </header>

      {/* =====================================================
          PLAYER
      ====================================================== */}

      <section className="watchArea">
        <div className="player">
          <video
            ref={videoRef}
            className="video"
            controls
            playsInline
            preload="auto"
            onPlaying={() => {
              setPlaying(true);
              setLoading(false);
              setError("");
            }}
            onCanPlay={() => {
              const video =
                videoRef.current;

              if (
                video &&
                !video.paused
              ) {
                setLoading(false);
              }
            }}
            onEnded={
              handleEnded
            }
          />

          {subtitleText && (
            <div
              className="absolute left-1/2 bottom-[12%] z-30 w-[92%] -translate-x-1/2 text-center pointer-events-none px-2"
              aria-live="polite"
            >
              <span
                className="inline-block max-w-full whitespace-pre-line rounded-sm bg-black/55 px-2 py-0.5 text-[clamp(16px,2.2vw,30px)] font-semibold leading-[1.25] text-white"
                style={{
                  textShadow:
                    "0 2px 3px rgba(0,0,0,.95), 0 -1px 2px rgba(0,0,0,.95), 1px 0 2px rgba(0,0,0,.95), -1px 0 2px rgba(0,0,0,.95)",
                }}
              >
                {subtitleText}
              </span>
            </div>
          )}

          {/* =================================================
              EPISODE BUTTON
          ================================================== */}

          <button
            type="button"
            className="episodeButton"
            aria-label="Daftar episode"
            onClick={() =>
              setDrawerOpen(true)
            }
          >
            <span />
            <span />
            <span />
          </button>

          {/* =================================================
              MOBILE EPISODE CONTROLS
          ================================================== */}

          <div className="mobileEpisodeControls">
            <button
              type="button"
              disabled={currentIndex <= 0}
              onClick={() => {
                if (currentIndex > 0) {
                  playEpisode(currentIndex - 1);
                }
              }}
            >
              ‹ Sebelumnya
            </button>

            <button
              type="button"
              disabled={
                currentIndex >=
                episodes.length - 1
              }
              onClick={() => {
                if (
                  currentIndex <
                  episodes.length - 1
                ) {
                  playEpisode(currentIndex + 1);
                }
              }}
            >
              Selanjutnya ›
            </button>
          </div>

          {/* =================================================
              LOADING
          ================================================== */}

          {loading &&
            !playing &&
            !error && (
              <div className="loadingOverlay">
                <div className="spinner" />
              </div>
            )}

          {/* =================================================
              ERROR
          ================================================== */}

          {error && (
            <div className="errorOverlay">
              <div className="errorBox">
                <div className="errorText">
                  {error}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    playEpisode(
                      currentIndex
                    )
                  }
                >
                  Coba lagi
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          DESKTOP EPISODE BAR
      ====================================================== */}

      {episodes.length > 0 && (
        <section className="desktopEpisodeBar">
          <div className="desktopEpisodeHeader">
            <div>
              <strong>
                {dramaMetadataRef.current.title || "Episode"}
              </strong>
              <span>
                Episode {currentIndex + 1} / {episodes.length}
              </span>
            </div>

            <div className="desktopNav">
              <button
                type="button"
                disabled={currentIndex <= 0}
                onClick={() => {
                  if (currentIndex > 0) {
                    playEpisode(currentIndex - 1);
                  }
                }}
              >
                ← Sebelumnya
              </button>

              <button
                type="button"
                disabled={currentIndex >= episodes.length - 1}
                onClick={() => {
                  if (currentIndex < episodes.length - 1) {
                    playEpisode(currentIndex + 1);
                  }
                }}
              >
                Berikutnya →
              </button>
            </div>
          </div>

          <div className="desktopEpisodeList">
            {episodes.map((episode, index) => (
              <button
                key={
                  String(
                    episode.id ??
                      episode.chapter_id ??
                      episode.chapterId ??
                      index
                  ) + "-desktop"
                }
                type="button"
                className={
                  index === currentIndex
                    ? "desktopEpisodeItem active"
                    : "desktopEpisodeItem"
                }
                onClick={() => {
                  playEpisode(index);
                }}
              >
                {getEpisodeNumber(episode, index)}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================
          EPISODE DRAWER
      ====================================================== */}

      {drawerOpen && (
        <div
          className="drawerBackdrop"
          onClick={() =>
            setDrawerOpen(false)
          }
        >
          <aside
            className="episodeDrawer"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="drawerHeader">
              <div>
                <strong className="drawerTitle">
                  {dramaMetadataRef.current.title || "Drama"}
                </strong>

                <small>
                  {episodes.length} episode
                </small>
              </div>

              <button
                type="button"
                className="closeButton"
                aria-label="Tutup"
                onClick={() =>
                  setDrawerOpen(false)
                }
              >
                ×
              </button>
            </div>

            <div className="episodeList">
              {episodes.map(
                (
                  episode,
                  index
                ) => {
                  const number =
                    getEpisodeNumber(
                      episode,
                      index
                    );

                  const title =
                    getEpisodeTitle(
                      episode,
                      index
                    );

                  const active =
                    index ===
                    currentIndex;

                  return (
                    <button
                      key={`${String(
                        episode.id ??
                          episode.chapter_id ??
                          episode.chapterId ??
                          index
                      )}-${index}`}
                      type="button"
                      className={`episodeItem ${
                        active
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        playEpisode(
                          index
                        )
                      }
                    >
                      <span className="episodeNumber">
                        {String(
                          number
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <span className="episodeName">
                        {title}
                      </span>

                      {active && (
                        <span className="playingDot">
                          ●
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </aside>
        </div>
      )}

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #000;
        }

        .watchPage {
          position: fixed;
          inset: 0;

          width: 100%;
          height: 100dvh;

          display: flex;
          flex-direction: column;

          overflow: hidden;

          background: #000;
          color: #fff;
        }

        .topHeader {
          position: relative;
          z-index: 50;

          flex: 0 0 58px;

          width: 100%;
          height: 58px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 0 18px;

          background: #05070b;

          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.08
            );
        }

        .brand {
          display: flex;
          align-items: center;

          gap: 8px;

          color: #fff;
          text-decoration: none;

          font-size: 20px;
          font-weight: 900;

          letter-spacing: -0.5px;
        }

        .brandIcon {
          width: 27px;
          height: 27px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 8px;

          background: #fff;
          color: #05070b;

          font-size: 11px;
        }

        .homeButton {
          color: rgba(
            255,
            255,
            255,
            0.7
          );

          text-decoration: none;

          font-size: 13px;
          font-weight: 600;
        }

        .watchArea {
          position: relative;

          flex: 1;

          width: 100%;
          min-height: 0;

          display: flex;
          align-items: center;
          justify-content: center;

          background: #000;

          overflow: hidden;
        }

        .player {
          position: relative;

          width: 100%;
          height: 100%;

          display: flex;
          align-items: center;
          justify-content: center;

          background: #000;

          overflow: hidden;
        }

        .video {
          display: block;

          width: 100%;
          height: 100%;

          background: #000;

          object-fit: contain;
          object-position: center center;
        }

        .episodeButton {
          position: absolute;

          top: 14px;
          right: 14px;

          z-index: 20;

          width: 43px;
          height: 43px;

          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          gap: 5px;

          padding: 0;

          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.2
            );

          border-radius: 12px;

          background: rgba(
            0,
            0,
            0,
            0.6
          );

          color: #fff;

          cursor: pointer;

          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(
            10px
          );
        }

        .episodeButton:active {
          transform: scale(
            0.94
          );
        }

        .episodeButton span {
          width: 18px;
          height: 2px;

          border-radius: 99px;

          background: #fff;
        }

        .mobileEpisodeControls {
          position: absolute;
          left: 50%;
          bottom: 14px;
          z-index: 20;
          transform: translateX(-50%);
          display: none;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: calc(100% - 24px);
          pointer-events: none;
        }

        .mobileEpisodeControls button {
          min-height: 34px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 8px;
          background: rgba(0,0,0,.72);
          color: #fff;
          padding: 0 12px;
          font-size: 11px;
          font-weight: 700;
          pointer-events: auto;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .mobileEpisodeControls button:disabled {
          opacity: .28;
        }

        .desktopEpisodeBar {
          flex: 0 0 auto;
          width: 100%;
          max-height: 150px;
          overflow: hidden;
          padding: 10px 14px 12px;
          background: #0b0e14;
          border-top: 1px solid rgba(255,255,255,.08);
        }

        .desktopEpisodeHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .desktopEpisodeHeader strong {
          display: block;
          font-size: 12px;
          font-weight: 800;
        }

        .desktopEpisodeHeader span {
          display: block;
          margin-top: 2px;
          color: rgba(255,255,255,.45);
          font-size: 10px;
        }

        .desktopNav {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .desktopNav button {
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 8px;
          background: rgba(255,255,255,.05);
          color: rgba(255,255,255,.75);
          padding: 7px 10px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .desktopNav button:last-child {
          background: #fff;
          color: #000;
        }

        .desktopNav button:disabled {
          opacity: .3;
        }

        .desktopEpisodeList {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .desktopEpisodeItem {
          flex: 0 0 auto;
          min-width: 38px;
          height: 34px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 8px;
          background: rgba(255,255,255,.05);
          color: rgba(255,255,255,.65);
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .desktopEpisodeItem.active {
          border-color: rgba(255,255,255,.55);
          background: #fff;
          color: #000;
        }

        .loadingOverlay {
          position: absolute;
          inset: 0;

          z-index: 10;

          display: flex;
          align-items: center;
          justify-content: center;

          pointer-events: none;

          background: transparent;
        }

        .spinner {
          width: 34px;
          height: 34px;

          border: 3px solid
            rgba(
              255,
              255,
              255,
              0.18
            );

          border-top-color: #fff;

          border-radius: 50%;

          animation:
            spin
            0.8s
            linear
            infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(
              360deg
            );
          }
        }

        .errorOverlay {
          position: absolute;
          inset: 0;

          z-index: 30;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 20px;

          background: rgba(
            0,
            0,
            0,
            0.72
          );
        }

        .errorBox {
          text-align: center;
        }

        .errorText {
          max-width: 300px;

          color: #fff;

          font-size: 13px;
          line-height: 1.5;
        }

        .errorBox button {
          margin-top: 12px;

          padding: 9px 16px;

          border: 0;
          border-radius: 8px;

          background: #fff;
          color: #000;

          font-size: 13px;
          font-weight: 700;

          cursor: pointer;
        }

        .errorBox button:active {
          transform: scale(
            0.96
          );
        }

        .drawerBackdrop {
          position: fixed;
          inset: 0;

          z-index: 100;

          background: rgba(
            0,
            0,
            0,
            0.6
          );
        }

        .episodeDrawer {
          position: absolute;

          top: 0;
          right: 0;
          bottom: 0;

          width: min(
            360px,
            88vw
          );

          display: flex;
          flex-direction: column;

          background: #0b0e14;

          border-left: 1px solid
            rgba(
              255,
              255,
              255,
              0.08
            );

          box-shadow:
            -15px 0
              50px
              rgba(
                0,
                0,
                0,
                0.5
              );

          animation:
            drawerIn
            0.2s
            ease-out;
        }

        @keyframes drawerIn {
          from {
            transform: translateX(
              100%
            );
          }

          to {
            transform: translateX(
              0
            );
          }
        }

        .drawerHeader {
          flex: 0 0 auto;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 18px;

          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.08
            );
        }

        .drawerHeader strong {
          display: block;

          max-width: 250px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;

          font-size: 15px;
          font-weight: 800;
        }

        .drawerHeader small {
          display: block;

          margin-top: 3px;

          color: rgba(
            255,
            255,
            255,
            0.45
          );

          font-size: 12px;
        }

        .closeButton {
          width: 36px;
          height: 36px;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 0;
          border-radius: 10px;

          background: rgba(
            255,
            255,
            255,
            0.07
          );

          color: #fff;
          font-size: 25px;
          line-height: 1;
          cursor: pointer;
        }

        .episodeList {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          overscroll-behavior: contain;
        }

        .episodeItem {
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          margin-bottom: 4px;
          padding: 8px 10px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: rgba(255,255,255,.72);
          text-align: left;
          cursor: pointer;
          transition: background .15s ease, color .15s ease;
        }

        .episodeItem:hover { background: rgba(255,255,255,.05); }
        .episodeItem.active { background: rgba(255,255,255,.1); color: #fff; }

        .episodeNumber {
          flex: 0 0 42px;
          font-size: 12px;
          font-weight: 800;
          color: rgba(255,255,255,.4);
        }

        .episodeItem.active .episodeNumber { color: #fff; }

        .episodeName {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 14px;
          font-weight: 600;
        }

        .playingDot {
          margin-left: 8px;
          font-size: 9px;
          color: #fff;
        }

        @media (max-width: 600px) {
          .topHeader { flex-basis: 54px; height: 54px; padding: 0 14px; }
          .brand { font-size: 18px; }
          .brandIcon { width: 25px; height: 25px; border-radius: 7px; }
          .homeButton { font-size: 12px; }
          .episodeButton { top: 10px; right: 10px; width: 39px; height: 39px; border-radius: 10px; }
          .episodeButton span { width: 16px; }
          .episodeDrawer { width: 90vw; }
        }

        @media (max-width: 360px) {
          .topHeader { padding: 0 12px; }
          .episodeDrawer { width: 94vw; }
        }
      `}</style>
    </main>
  );
}