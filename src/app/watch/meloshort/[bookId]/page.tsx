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

interface VideoData {
  streams?: Stream[];
  subtitles?: Subtitle[];
  subs?: Subtitle[];
  episode_index?: number;
  total_episodes?: number;
  title?: string;
  duration?: number;
  next_video_id?: string;
  prev_video_id?: string;
  [key: string]: any;
}

const WORKER_PROXY =
  "https://tplay-proxy.3twidy.workers.dev/?url=";

export default function WatchPage() {
  const params = useParams();
  const bookId = String(params.bookId || "");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const currentStreamRef = useRef("");
  const currentSubtitleRef = useRef("");

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dramaTitle, setDramaTitle] = useState("TPLAY");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // LOAD DETAIL
  // =========================================================

  const loadDetail = useCallback(async () => {
    try {
      setError("");

      const url =
        `/api/meloshort?path=/api/v2/detail` +
        `&category_p=meloshort` +
        `&id=${encodeURIComponent(bookId)}` +
        `&lang=id`;

      const response = await fetch(url, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Detail API error ${response.status}`);
      }

      const json = await response.json();

      const data = json?.data || json;

      const foundEpisodes =
        data?.chapters ||
        data?.episodes ||
        data?.list ||
        [];

      if (!Array.isArray(foundEpisodes) || foundEpisodes.length === 0) {
        throw new Error("Episode tidak ditemukan.");
      }

      setEpisodes(foundEpisodes);

      const title =
        data?.bookName ||
        data?.title ||
        data?.name ||
        "TPLAY";

      setDramaTitle(title);

      return foundEpisodes as Episode[];
    } catch (err: any) {
      console.error("DETAIL ERROR:", err);
      setError(err?.message || "Gagal memuat drama.");
      throw err;
    }
  }, [bookId]);

  // =========================================================
  // DESTROY HLS
  // =========================================================

  const destroyPlayer = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}

      hlsRef.current = null;
    }

    const video = videoRef.current;

    if (video) {
      video.pause();
      video.removeAttribute("src");

      while (video.firstChild) {
        video.removeChild(video.firstChild);
      }

      try {
        video.load();
      } catch {}
    }
  }, []);

  // =========================================================
  // PLAY STREAM
  // =========================================================

  const playStream = useCallback(
    async (
      streamUrl: string,
      subtitleUrl?: string,
      autoplay = true
    ) => {
      const video = videoRef.current;

      if (!video || !streamUrl) {
        throw new Error("Video player belum siap.");
      }

      destroyPlayer();

      currentStreamRef.current = streamUrl;
      currentSubtitleRef.current = subtitleUrl || "";

      const playableUrl =
        WORKER_PROXY + encodeURIComponent(streamUrl);

      const proxiedSubtitle = subtitleUrl
        ? WORKER_PROXY + encodeURIComponent(subtitleUrl)
        : "";

      // -------------------------------------------------------
      // SUBTITLE
      // -------------------------------------------------------

      if (proxiedSubtitle) {
        const track = document.createElement("track");

        track.kind = "subtitles";
        track.label = "Indonesia";
        track.srclang = "id";
        track.src = proxiedSubtitle;
        track.default = true;

        video.appendChild(track);
      }

      // -------------------------------------------------------
      // HLS.JS
      // -------------------------------------------------------

      try {
        const HlsModule = await import("hls.js");
        const Hls = HlsModule.default;

        if (
          Hls &&
          Hls.isSupported() &&
          streamUrl.includes(".m3u8")
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

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (autoplay) {
              video.play().catch(() => {});
            }
          });

          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            console.error("HLS ERROR:", data);

            if (!data?.fatal) return;

            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                try {
                  hls.startLoad();
                } catch {}
                break;

              case Hls.ErrorTypes.MEDIA_ERROR:
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

                if (autoplay) {
                  video.play().catch(() => {});
                }

                break;
            }
          });

          return;
        }
      } catch (err) {
        console.warn("HLS.js gagal dimuat:", err);
      }

      // -------------------------------------------------------
      // NATIVE HLS FALLBACK
      // -------------------------------------------------------

      video.src = playableUrl;

      if (autoplay) {
        video.play().catch(() => {});
      }
    },
    [destroyPlayer]
  );

  // =========================================================
  // LOAD EPISODE
  // =========================================================

  const playEpisode = useCallback(
    async (
      index: number,
      episodeList?: Episode[]
    ) => {
      const list = episodeList || episodes;
      const episode = list[index];

      if (!episode) return;

      try {
        setEpisodeLoading(true);
        setError("");
        setCurrentIndex(index);

        const chapterId =
          episode.id ??
          episode.chapterId ??
          episode.chapter_id ??
          episode.episode ??
          index + 1;

        const url =
          `/api/meloshort?path=/api/v2/video` +
          `&category_p=meloshort` +
          `&id=${encodeURIComponent(bookId)}` +
          `&chapterId=${encodeURIComponent(String(chapterId))}` +
          `&lang=id`;

        const response = await fetch(url, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Video API error ${response.status}`);
        }

        const json = await response.json();

        const data: VideoData =
          json?.data ||
          json;

        const streams =
          data?.streams ||
          data?.urls ||
          [];

        if (!Array.isArray(streams) || streams.length === 0) {
          throw new Error("Stream video tidak tersedia.");
        }

        // Prioritas kualitas tinggi
        const stream =
          streams.find((item) =>
            /1080/i.test(item?.quality || "")
          ) ||
          streams.find((item) =>
            /720/i.test(item?.quality || "")
          ) ||
          streams.find((item) =>
            /480/i.test(item?.quality || "")
          ) ||
          streams.find((item) =>
            /360/i.test(item?.quality || "")
          ) ||
          streams[0];

        if (!stream?.url) {
          throw new Error("URL stream tidak ditemukan.");
        }

        const subtitles =
          data?.subtitles ||
          data?.subs ||
          [];

        // Prioritaskan subtitle Indonesia
        const indonesiaSubtitle =
          subtitles.find(
            (sub) =>
              sub?.languageCode === "id" ||
              /indonesia/i.test(sub?.language || "")
          ) ||
          subtitles[0];

        await playStream(
          stream.url,
          indonesiaSubtitle?.url,
          true
        );

        setDrawerOpen(false);
      } catch (err: any) {
        console.error("PLAY ERROR:", err);

        setError(
          err?.message ||
            "Gagal memutar episode."
        );
      } finally {
        setEpisodeLoading(false);
        setLoading(false);
      }
    },
    [bookId, episodes, playStream]
  );

  // =========================================================
  // AUTO NEXT EPISODE
  // =========================================================

  const handleVideoEnded = useCallback(() => {
    const nextIndex = currentIndex + 1;

    if (nextIndex < episodes.length) {
      playEpisode(nextIndex);
    }
  }, [currentIndex, episodes.length, playEpisode]);

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const list = await loadDetail();

        if (cancelled) return;

        // Ambil episode dari query ?episode=
        const searchParams = new URLSearchParams(
          window.location.search
        );

        const requestedEpisode = Number(
          searchParams.get("episode") || "1"
        );

        let initialIndex = requestedEpisode - 1;

        if (
          !Number.isFinite(initialIndex) ||
          initialIndex < 0
        ) {
          initialIndex = 0;
        }

        if (initialIndex >= list.length) {
          initialIndex = 0;
        }

        await playEpisode(initialIndex, list);
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
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

  // =========================================================
  // KEYBOARD
  // =========================================================

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="watchPage">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="topHeader">
        <Link href="/" className="brand">
          <span className="brandIcon">▶</span>
          <span>TPLAY</span>
        </Link>

        <Link href="/" className="homeButton">
          Home
        </Link>
      </header>

      {/* =====================================================
          PLAYER
      ====================================================== */}

      <section className="playerSection">
        <div className="player">

          <video
            ref={videoRef}
            className="video"
            controls
            playsInline
            preload="metadata"
            onEnded={handleVideoEnded}
          />

          {/* HAMBURGER — SELALU TERLIHAT */}
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

          {/* LOADING */}
          {(loading || episodeLoading) && (
            <div className="loadingOverlay">
              <div className="spinner" />
            </div>
          )}

          {/* ERROR */}
          {error && !loading && (
            <div className="errorOverlay">
              <div className="errorBox">
                <div>Gagal memutar video</div>

                <button
                  type="button"
                  onClick={() =>
                    playEpisode(currentIndex)
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
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="drawerHeader">
              <div>
                <strong>Episode</strong>
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
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            <div className="episodeList">
              {episodes.map(
                (episode, index) => {
                  const episodeNumber =
                    episode.episode ??
                    episode.episode_index ??
                    episode.index ??
                    index + 1;

                  const title =
                    episode.title ||
                    episode.name ||
                    `Episode ${episodeNumber}`;

                  const active =
                    index === currentIndex;

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
                        playEpisode(index)
                      }
                    >
                      <span className="episodeNumber">
                        {String(
                          episodeNumber
                        ).padStart(2, "0")}
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

        .watchPage {
          min-height: 100vh;
          margin: 0;
          padding: 0;
          background: #05070b;
          color: #fff;
        }

        /* =====================================================
           HEADER
        ====================================================== */

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

          background: rgba(5, 7, 11, 0.96);
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.07);

          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;

          color: #fff;
          text-decoration: none;

          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.5px;
        }

        .brandIcon {
          display: flex;
          align-items: center;
          justify-content: center;

          width: 27px;
          height: 27px;

          border-radius: 8px;

          background: #fff;
          color: #05070b;

          font-size: 11px;
        }

        .homeButton {
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;

          font-size: 13px;
          font-weight: 600;

          transition: color 0.2s ease;
        }

        .homeButton:hover {
          color: #fff;
        }

        /* =====================================================
           PLAYER
        ====================================================== */

        .playerSection {
          width: 100%;
          margin: 0;
          padding: 0;
        }

        .player {
          position: relative;

          width: 100%;
          aspect-ratio: 16 / 9;

          background: #000;

          overflow: hidden;
        }

        .video {
          display: block;

          width: 100%;
          height: 100%;

          object-fit: contain;

          background: #000;
        }

        /* =====================================================
           HAMBURGER
        ====================================================== */

        .episodeButton {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 10;

          width: 42px;
          height: 42px;

          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;

          padding: 0;

          border: 1px solid
            rgba(255, 255, 255, 0.18);

          border-radius: 12px;

          background: rgba(0, 0, 0, 0.62);
          color: #fff;

          cursor: pointer;

          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);

          transition:
            background 0.2s ease,
            transform 0.2s ease;
        }

        .episodeButton:hover {
          background: rgba(0, 0, 0, 0.82);
        }

        .episodeButton:active {
          transform: scale(0.94);
        }

        .episodeButton span {
          display: block;

          width: 18px;
          height: 2px;

          border-radius: 99px;

          background: #fff;
        }

        /* =====================================================
           LOADING
        ====================================================== */

        .loadingOverlay {
          position: absolute;
          inset: 0;

          z-index: 5;

          display: flex;
          align-items: center;
          justify-content: center;

          pointer-events: none;
        }

        .spinner {
          width: 34px;
          height: 34px;

          border: 3px solid
            rgba(255, 255, 255, 0.2);

          border-top-color: #fff;

          border-radius: 50%;

          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* =====================================================
           ERROR
        ====================================================== */

        .errorOverlay {
          position: absolute;
          inset: 0;

          z-index: 7;

          display: flex;
          align-items: center;
          justify-content: center;

          background: rgba(0, 0, 0, 0.55);

          pointer-events: none;
        }

        .errorBox {
          pointer-events: auto;

          text-align: center;

          color: #fff;

          font-size: 14px;
        }

        .errorBox button {
          margin-top: 12px;

          padding: 9px 16px;

          border: 0;
          border-radius: 8px;

          background: #fff;
          color: #000;

          font-weight: 700;

          cursor: pointer;
        }

        /* =====================================================
           DRAWER BACKDROP
        ====================================================== */

        .drawerBackdrop {
          position: fixed;
          inset: 0;
          z-index: 100;

          background: rgba(0, 0, 0, 0.58);

          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
        }

        /* =====================================================
           DRAWER
        ====================================================== */

        .episodeDrawer {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;

          width: min(360px, 88vw);

          display: flex;
          flex-direction: column;

          background: #0b0e14;

          border-left: 1px solid
            rgba(255, 255, 255, 0.08);

          box-shadow:
            -15px 0 50px
            rgba(0, 0, 0, 0.45);

          animation: drawerIn 0.22s ease-out;
        }

        @keyframes drawerIn {
          from {
            transform: translateX(100%);
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
            rgba(255, 255, 255, 0.07);
        }

        .drawerHeader strong {
          display: block;

          font-size: 17px;
          font-weight: 800;
        }

        .drawerHeader small {
          display: block;

          margin-top: 3px;

          color: rgba(255, 255, 255, 0.45);

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
        }

        .episodeItem {
          width: 100%;

          display: flex;
          align-items: center;

          min-height: 52px;

          margin-bottom: 4px;
          padding: 8px 10px;

          border: 0;
          border-radius: 10px;

          background: transparent;
          color: rgba(255, 255, 255, 0.72);

          text-align: left;

          cursor: pointer;

          transition:
            background 0.18s ease,
            color 0.18s ease;
        }

        .episodeItem:hover {
          background: rgba(
            255,
            255,
            255,
            0.06
          );

          color: #fff;
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

          color: rgba(255, 255, 255, 0.4);
        }

        .episodeItem.active
          .episodeNumber {
          color: #fff;
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
          flex: 0 0 auto;

          margin-left: 8px;

          font-size: 9px;

          color: #fff;
        }

        /* =====================================================
           MOBILE
        ====================================================== */

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
            top: 10px;
            right: 10px;

            width: 38px;
            height: 38px;

            border-radius: 10px;
          }

          .episodeButton span {
            width: 16px;
          }

          .episodeDrawer {
            width: min(340px, 90vw);
          }
        }
      `}</style>
    </main>
  );
}
