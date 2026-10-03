"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

const WORKER_PROXY =
  "https://tplay-proxy.3twidy.workers.dev/?url=";

export default function WatchPage() {
  const params = useParams();
  const bookId = String(params.bookId || "");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  // ---------------------------------------------------------
  // CLEAN PLAYER
  // ---------------------------------------------------------

  const destroyPlayer = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}

      hlsRef.current = null;
    }

    const video = videoRef.current;

    if (!video) return;

    try {
      video.pause();
    } catch {}

    video.removeAttribute("src");

    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }

    try {
      video.load();
    } catch {}
  }, []);

  // ---------------------------------------------------------
  // PLAY STREAM
  // ---------------------------------------------------------

  const playStream = useCallback(
    async (
      originalUrl: string,
      subtitleUrl?: string
    ) => {
      const video = videoRef.current;

      if (!video) {
        throw new Error("Player belum siap.");
      }

      destroyPlayer();

      setError("");
      setLoading(true);
      setPlaying(false);

      const playableUrl =
        WORKER_PROXY +
        encodeURIComponent(originalUrl);

      const proxiedSubtitle = subtitleUrl
        ? WORKER_PROXY +
          encodeURIComponent(subtitleUrl)
        : "";

      // -----------------------------------------------------
      // SUBTITLE
      // -----------------------------------------------------

      if (proxiedSubtitle) {
        const track =
          document.createElement("track");

        track.kind = "subtitles";
        track.label = "Indonesia";
        track.srclang = "id";
        track.src = proxiedSubtitle;
        track.default = true;

        video.appendChild(track);
      }

      // -----------------------------------------------------
      // VIDEO EVENTS
      // -----------------------------------------------------

      const handlePlaying = () => {
        setPlaying(true);
        setLoading(false);
        setError("");
      };

      const handleWaiting = () => {
        // Jangan bikin spinner berkedip ketika buffering
        // kecil. Video tetap terlihat.
      };

      const handleError = () => {
        // Jangan langsung tampilkan popup.
        // HLS.js sendiri akan menangani error fatal.
        console.warn(
          "Native video error:",
          video.error
        );
      };

      video.addEventListener(
        "playing",
        handlePlaying
      );

      video.addEventListener(
        "waiting",
        handleWaiting
      );

      video.addEventListener(
        "error",
        handleError
      );

      // -----------------------------------------------------
      // HLS.JS
      // -----------------------------------------------------

      try {
        const HlsModule =
          await import("hls.js");

        const Hls = HlsModule.default;

        if (
          Hls &&
          Hls.isSupported() &&
          originalUrl.includes(".m3u8")
        ) {
          const hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
          });

          hlsRef.current = hls;

          hls.loadSource(playableUrl);
          hls.attachMedia(video);

          hls.on(
            Hls.Events.MANIFEST_PARSED,
            () => {
              video
                .play()
                .catch((err: any) => {
                  console.warn(
                    "Autoplay gagal:",
                    err
                  );
                });
            }
          );

          hls.on(
            Hls.Events.ERROR,
            (_event: any, data: any) => {
              console.warn(
                "HLS:",
                data?.type,
                data?.details,
                data?.fatal
              );

              if (!data?.fatal) {
                return;
              }

              switch (data.type) {
                case Hls.ErrorTypes
                  .NETWORK_ERROR:
                  try {
                    hls.startLoad();
                  } catch {}
                  break;

                case Hls.ErrorTypes
                  .MEDIA_ERROR:
                  try {
                    hls.recoverMediaError();
                  } catch {}
                  break;

                default:
                  try {
                    hls.destroy();
                  } catch {}

                  hlsRef.current = null;

                  // Native fallback
                  video.src = playableUrl;

                  video
                    .play()
                    .catch(() => {});
                  break;
              }
            }
          );

          // Penting:
          // Jangan await event HLS di sini.
          // Fungsi dianggap sukses begitu HLS sudah
          // berhasil dipasang ke video.
          return;
        }
      } catch (err) {
        console.warn(
          "HLS.js tidak dapat digunakan:",
          err
        );
      }

      // -----------------------------------------------------
      // NATIVE FALLBACK
      // -----------------------------------------------------

      video.src = playableUrl;

      video.load();

      video
        .play()
        .catch((err) => {
          console.warn(
            "Native autoplay gagal:",
            err
          );
        });
    },
    [destroyPlayer]
  );

  // ---------------------------------------------------------
  // LOAD DETAIL
  // ---------------------------------------------------------

  const loadDetail = useCallback(async () => {
    const response = await fetch(
      `/api/meloshort?path=/api/v2/detail` +
        `&category_p=meloshort` +
        `&id=${encodeURIComponent(bookId)}` +
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

    const json = await response.json();

    const data = json?.data || json;

    const list =
      data?.chapters ||
      data?.episodes ||
      data?.list ||
      [];

    if (!Array.isArray(list) || !list.length) {
      throw new Error(
        "Episode tidak ditemukan."
      );
    }

    return list as Episode[];
  }, [bookId]);

  // ---------------------------------------------------------
  // PLAY EPISODE
  // ---------------------------------------------------------

  const playEpisode = useCallback(
    async (
      index: number,
      listOverride?: Episode[]
    ) => {
      const list =
        listOverride || episodes;

      const episode = list[index];

      if (!episode) return;

      setCurrentIndex(index);
      setError("");
      setLoading(true);
      setPlaying(false);

      try {
        const chapterId =
          episode.id ??
          episode.chapterId ??
          episode.chapter_id ??
          episode.episode ??
          index + 1;

        const response = await fetch(
          `/api/meloshort?path=/api/v2/video` +
            `&category_p=meloshort` +
            `&id=${encodeURIComponent(bookId)}` +
            `&chapterId=${encodeURIComponent(
              String(chapterId)
            )}` +
            `&lang=id`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Video API ${response.status}`
          );
        }

        const json = await response.json();

        const data =
          json?.data || json;

        const streams =
          data?.streams ||
          data?.urls ||
          [];

        if (
          !Array.isArray(streams) ||
          !streams.length
        ) {
          throw new Error(
            "Stream video tidak tersedia."
          );
        }

        const stream =
          streams.find((x: Stream) =>
            /1080/i.test(
              x?.quality || ""
            )
          ) ||
          streams.find((x: Stream) =>
            /720/i.test(
              x?.quality || ""
            )
          ) ||
          streams.find((x: Stream) =>
            /480/i.test(
              x?.quality || ""
            )
          ) ||
          streams[0];

        if (!stream?.url) {
          throw new Error(
            "URL video tidak ditemukan."
          );
        }

        const subtitles =
          data?.subtitles ||
          data?.subs ||
          [];

        const indonesia =
          subtitles.find(
            (x: Subtitle) =>
              x?.languageCode === "id"
          ) ||
          subtitles.find(
            (x: Subtitle) =>
              /indonesia/i.test(
                x?.language || ""
              )
          ) ||
          subtitles[0];

        /*
         * Di sini kita sengaja TIDAK menunggu video
         * selesai loading.
         *
         * playStream langsung memasang HLS.
         * Jadi tidak akan muncul error palsu hanya
         * karena HLS masih membutuhkan waktu untuk
         * mulai memutar.
         */
        await playStream(
          stream.url,
          indonesia?.url
        );

        setDrawerOpen(false);

        /*
         * Jangan setError di sini.
         * Jika video belum siap, event "playing"
         * yang akan mengubah loading menjadi false.
         */
      } catch (err: any) {
        console.error(
          "PLAY EPISODE ERROR:",
          err
        );

        /*
         * Beri waktu HLS/native untuk mulai.
         * Ini mencegah popup error palsu ketika
         * stream sebenarnya sedang berhasil dimuat.
         */
        setTimeout(() => {
          const video =
            videoRef.current;

          if (
            video &&
            !video.paused &&
            video.currentTime > 0
          ) {
            setError("");
            setLoading(false);
            return;
          }

          setLoading(false);
          setError(
            err?.message ||
              "Gagal memuat episode."
          );
        }, 1500);
      }
    },
    [
      bookId,
      episodes,
      playStream,
    ]
  );

  // ---------------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        setLoading(true);
        setError("");

        const list =
          await loadDetail();

        if (cancelled) return;

        setEpisodes(list);

        const params =
          new URLSearchParams(
            window.location.search
          );

        const requested =
          Number(
            params.get("episode") || "1"
          );

        let index =
          Number.isFinite(requested)
            ? requested - 1
            : 0;

        if (index < 0) index = 0;

        if (index >= list.length) {
          index = 0;
        }

        await playEpisode(
          index,
          list
        );
      } catch (err: any) {
        if (!cancelled) {
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
    }

    if (bookId) {
      start();
    }

    return () => {
      cancelled = true;
      destroyPlayer();
    };
  }, [
    bookId,
    loadDetail,
    playEpisode,
    destroyPlayer,
  ]);

  // ---------------------------------------------------------
  // AUTO NEXT
  // ---------------------------------------------------------

  const handleEnded = () => {
    const next =
      currentIndex + 1;

    if (
      next < episodes.length
    ) {
      playEpisode(next);
    }
  };

  // ---------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------

  useEffect(() => {
    return () => {
      destroyPlayer();
    };
  }, [destroyPlayer]);

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <main className="watchPage">
      {/* HEADER */}

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

      {/* PLAYER */}

      <section className="playerSection">
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
            onEnded={handleEnded}
          />

          {/* HAMBURGER */}
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

          {/* LOADING HANYA SAAT BELUM PLAY */}
          {loading &&
            !playing &&
            !error && (
              <div className="loadingOverlay">
                <div className="spinner" />
              </div>
            )}

          {/* ERROR HANYA JIKA BENAR-BENAR GAGAL */}
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

      {/* EPISODE DRAWER */}

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
                <strong>
                  Episode
                </strong>

                <small>
                  {episodes.length} episode
                </small>
              </div>

              <button
                type="button"
                className="closeButton"
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
                    episode.episode ??
                    episode.episode_index ??
                    episode.index ??
                    index + 1;

                  const title =
                    episode.title ||
                    episode.name ||
                    `Episode ${number}`;

                  const active =
                    index ===
                    currentIndex;

                  return (
                    <button
                      key={`${String(
                        episode.id ??
                          episode.chapter_id ??
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
        }

        .watchPage {
          min-height: 100vh;
          width: 100%;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          background: #05070b;
          color: #fff;
        }

        /* ===============================
           HEADER
        ================================ */

        .topHeader {
          position: sticky;
          top: 0;
          z-index: 50;

          width: 100%;
          height: 58px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 0 18px;

          background: rgba(
            5,
            7,
            11,
            0.96
          );

          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.07
            );

          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(
            14px
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

        /* ===============================
           FULL WIDTH PLAYER
        ================================ */

        .playerSection {
          width: 100vw;
          max-width: none;

          margin-left: calc(
            50% - 50vw
          );

          margin-right: calc(
            50% - 50vw
          );

          padding: 0;
        }

        .player {
          position: relative;

          width: 100vw;
          max-width: 100vw;

          aspect-ratio: 16 / 9;

          margin: 0;
          padding: 0;

          background: #000;

          overflow: hidden;
        }

        .video {
          display: block;

          width: 100%;
          height: 100%;

          max-width: none;

          margin: 0;
          padding: 0;

          background: #000;

          object-fit: contain;
        }

        /* ===============================
           HAMBURGER
        ================================ */

        .episodeButton {
          position: absolute;

          top: 12px;
          right: 12px;

          z-index: 20;

          width: 42px;
          height: 42px;

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
              0.18
            );

          border-radius: 11px;

          background: rgba(
            0,
            0,
            0,
            0.58
          );

          cursor: pointer;

          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(
            10px
          );
        }

        .episodeButton span {
          width: 18px;
          height: 2px;

          border-radius: 99px;

          background: #fff;
        }

        /* ===============================
           LOADING
        ================================ */

        .loadingOverlay {
          position: absolute;
          inset: 0;

          z-index: 10;

          display: flex;
          align-items: center;
          justify-content: center;

          pointer-events: none;
        }

        .spinner {
          width: 32px;
          height: 32px;

          border: 3px solid
            rgba(
              255,
              255,
              255,
              0.18
            );

          border-top-color: #fff;

          border-radius: 50%;

          animation: spin
            0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* ===============================
           ERROR
        ================================ */

        .errorOverlay {
          position: absolute;
          inset: 0;

          z-index: 30;

          display: flex;
          align-items: center;
          justify-content: center;

          background: rgba(
            0,
            0,
            0,
            0.62
          );
        }

        .errorBox {
          text-align: center;
        }

        .errorText {
          max-width: 280px;

          font-size: 13px;
          color: #fff;
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

        /* ===============================
           DRAWER
        ================================ */

        .drawerBackdrop {
          position: fixed;
          inset: 0;

          z-index: 100;

          background: rgba(
            0,
            0,
            0,
            0.58
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
            -15px 0 50px
            rgba(
              0,
              0,
              0,
              0.45
            );

          animation: drawerIn
            0.2s ease-out;
        }

        @keyframes drawerIn {
          from {
            transform: translateX(
              100%
            );
          }

          to {
            transform: translateX(0);
          }
        }

        .drawerHeader {
          flex-shrink: 0;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 18px;

          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.07
            );
        }

        .drawerHeader strong {
          display: block;

          font-size: 17px;
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

          cursor: pointer;
        }

        .episodeList {
          flex: 1;

          overflow-y: auto;

          padding: 10px;
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
          color: rgba(
            255,
            255,
            255,
            0.72
          );

          text-align: left;

          cursor: pointer;
        }

        .episodeItem.active {
          background: rgba(
            255,
            255,
            255,
            0.1
          );

          color: #fff;
        }

        .episodeNumber {
          flex: 0 0 42px;

          font-size: 12px;
          font-weight: 800;

          color: rgba(
            255,
            255,
            255,
            0.4
          );
        }

        .episodeName {
          flex: 1;

          overflow: hidden;

          white-space: nowrap;
          text-overflow: ellipsis;

          font-size: 14px;
          font-weight: 600;
        }

        .playingDot {
          margin-left: 8px;

          font-size: 9px;
        }

        /* ===============================
           MOBILE
        ================================ */

        @media (max-width: 600px) {
          .topHeader {
            height: 54px;
            padding: 0 14px;
          }

          .brand {
            font-size: 18px;
          }

          .brandIcon {
            width: 25px;
            height: 25px;
          }

          .homeButton {
            font-size: 12px;
          }

          .episodeButton {
            top: 9px;
            right: 9px;

            width: 38px;
            height: 38px;
          }

          .episodeButton span {
            width: 16px;
          }

          .episodeDrawer {
            width: 90vw;
          }
        }
      `}</style>
    </main>
  );
}
