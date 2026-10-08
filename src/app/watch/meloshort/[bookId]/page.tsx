"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Hls from "hls.js";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

import {
  extractMeloShortEpisodes,
  extractMeloShortStream,
  extractMeloShortText,
  getMeloShortStream,
  useMeloShortDetail,
} from "@/hooks/useMeloShort";
import { useWatchHistoryStore } from "@/hooks/useWatchHistory";

export default function MeloShortWatchPage() {
  const params = useParams();
  const id = String(params.bookId || "");

  const videoRef = useRef<HTMLVideoElement>(null);

  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState("");
  const [episodeMenuOpen, setEpisodeMenuOpen] = useState(false);

  const addHistory = useWatchHistoryStore((state) => state.addItem);
  const detailQuery = useMeloShortDetail(id);

  const detail = detailQuery.data;

  // Detail response MeloShort can contain generic/category titles such as
  // "Drama Pilihan" before the actual drama object. Prefer the real title
  // from the main data object and ignore known generic labels.
  const getStardustHistoryTitle = (value: any): string => {
    const genericTitles = new Set([
      "drama pilihan",
      "meloshort",
      "untitled",
      "drama",
    ]);

    const titleKeys = [
      "title",
      "bookName",
      "book_name",
      "dramaName",
      "drama_name",
      "name",
    ];

    const candidates: string[] = [];

    const collect = (node: any, depth = 0) => {
      if (!node || typeof node !== "object" || depth > 5) return;

      if (Array.isArray(node)) {
        for (const item of node) collect(item, depth + 1);
        return;
      }

      for (const key of titleKeys) {
        const value = node[key];
        if (typeof value === "string" && value.trim()) {
          candidates.push(value.trim());
        }
      }

      // Search the main payload first, then nested objects.
      for (const key of ["data", "detail", "book", "drama", "result"]) {
        if (node[key] && typeof node[key] === "object") {
          collect(node[key], depth + 1);
        }
      }
    };

    collect(value);

    return (
      candidates.find(
        (candidate) => !genericTitles.has(candidate.toLowerCase()),
      ) || ""
    );
  };

  const title = getStardustHistoryTitle(detail);
  const cover = extractMeloShortText(
    detail,
    [
      "cover",
      "coverUrl",
      "cover_url",
      "poster",
      "posterUrl",
      "poster_url",
      "image",
      "imageUrl",
      "image_url",
      "thumbnail",
      "thumbnailUrl",
      "book_pic",
    ],
    "",
  );

  const episodes = extractMeloShortEpisodes(detail);

  useEffect(() => {
    if (episodes.length === 0) return;

    const firstEpisode = episodes[0];
    const firstNumber = Number(
      firstEpisode?.episode ??
        firstEpisode?.episodeNumber ??
        firstEpisode?.episode_index ??
        firstEpisode?.index ??
        1,
    );
    const firstChapterId = String(
      firstEpisode?.id ??
        firstEpisode?.chapterId ??
        firstEpisode?.chapter_id ??
        firstEpisode?.videoId ??
        firstEpisode?.video_id ??
        "",
    );

    if (Number.isFinite(firstNumber) && firstNumber > 0) {
      setSelectedEpisode(firstNumber);
    }
    if (firstChapterId) {
      setSelectedChapterId(firstChapterId);
    }
  }, [episodes]);

  useEffect(() => {
    let cancelled = false;

    async function loadVideo() {
      setError("");
      setStreamUrl("");

      try {
        if (!selectedChapterId) return;

        const response = await getMeloShortStream(id, selectedChapterId);
        const source = extractMeloShortStream(response);

        if (!source) {
          throw new Error("URL video MeloShort tidak ditemukan.");
        }

        if (!cancelled) {
          setStreamUrl(source);
        }
      } catch (streamError: unknown) {
        if (!cancelled) {
          setError(
            streamError instanceof Error
              ? streamError.message
              : "Gagal mengambil video MeloShort.",
          );
        }
      }
    }

    if (id) {
      void loadVideo();
    }

    return () => {
      cancelled = true;
    };
  }, [id, selectedEpisode, selectedChapterId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const proxyUrl =
      "/api/meloshort/stream?url=" + encodeURIComponent(streamUrl);
    const isHls = /\\.m3u8(?:$|[?#])/i.test(streamUrl);

    // MeloShort commonly returns HLS. Chrome/Edge do not play HLS
    // through a plain <video src>, so use hls.js when native HLS is absent.
    let hls: Hls | null = null;

    if (isHls && !video.canPlayType("application/vnd.apple.mpegurl")) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        });
        hls.loadSource(proxyUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setError(
              "Video MeloShort gagal dimuat: " +
                (data.details || "HLS error"),
            );
          }
        });
      } else {
        video.src = proxyUrl;
        video.load();
      }
    } else {
      video.src = proxyUrl;
      video.load();
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [streamUrl]);

  useEffect(() => {
    if (!id || !title || episodes.length === 0) {
      return;
    }

    addHistory({
      id,
      title,
      image: cover,
      platform: "MeloShort",
      timestamp: Date.now(),
      url: "/watch/meloshort/" + encodeURIComponent(id),
      episode: selectedEpisode,
      totalEpisodes: episodes.length,
    });
  }, [id, title, cover, selectedEpisode, episodes.length, addHistory]);

  const selectedIndex = episodes.findIndex((episode: any, index: number) => {
    const number = Number(
      episode?.episode ??
        episode?.episodeNumber ??
        episode?.episode_index ??
        episode?.index ??
        index + 1,
    );
    return number === selectedEpisode;
  });

  const previousEpisode =
    selectedIndex > 0 ? episodes[selectedIndex - 1] : null;
  const nextEpisode =
    selectedIndex >= 0 && selectedIndex < episodes.length - 1
      ? episodes[selectedIndex + 1]
      : null;

  const episodeNumber = (episode: any, index: number) =>
    Number(
      episode?.episode ??
        episode?.episodeNumber ??
        episode?.episode_index ??
        episode?.index ??
        index + 1,
    );

  const chapterIdOf = (episode: any) =>
    String(
      episode?.id ??
        episode?.chapterId ??
        episode?.chapter_id ??
        episode?.videoId ??
        episode?.video_id ??
        "",
    );

  const playEpisode = (episode: any, index: number) => {
    const number = episodeNumber(episode, index);
    const chapterId = chapterIdOf(episode);

    if (!chapterId) return;

    setSelectedEpisode(number);
    setSelectedChapterId(chapterId);
    setEpisodeMenuOpen(false);
  };

  return (
    <main className="fixed inset-0 flex flex-col bg-black text-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black px-4">
        <Link href="/" className="text-sm font-semibold">
          TPLAY
        </Link>

        <Link
          href={"/detail/meloshort/" + encodeURIComponent(id)}
          className="text-sm text-white/70"
        >
          Detail
        </Link>
      </header>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          <video
            ref={videoRef}
            controls
            playsInline
            className="h-full w-full object-contain"
          />

          {episodes.length > 0 && (
            <>
              {/* Mobile episode picker inside the player */}
              <button
                type="button"
                onClick={() => setEpisodeMenuOpen((open) => !open)}
                className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md md:hidden"
                aria-label="Buka daftar episode"
              >
                {episodeMenuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
                <span>Ep {selectedEpisode}</span>
              </button>

              {/* Mobile previous / next episode controls */}
              <div className="pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center gap-3 md:hidden">
                <button
                  type="button"
                  disabled={!previousEpisode}
                  onClick={() =>
                    previousEpisode &&
                    playEpisode(previousEpisode, selectedIndex - 1)
                  }
                  className="pointer-events-auto flex h-10 items-center gap-1 rounded-full border border-white/20 bg-black/70 px-4 text-xs font-semibold text-white backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </button>

                <button
                  type="button"
                  disabled={!nextEpisode}
                  onClick={() =>
                    nextEpisode &&
                    playEpisode(nextEpisode, selectedIndex + 1)
                  }
                  className="pointer-events-auto flex h-10 items-center gap-1 rounded-full border border-white/20 bg-black/70 px-4 text-xs font-semibold text-white backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Berikutnya
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile episode drawer */}
              {episodeMenuOpen && (
                <div className="absolute inset-x-3 top-14 z-30 max-h-[65%] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e27]/95 p-3 shadow-2xl backdrop-blur-xl md:hidden">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div>
                      <p className="text-sm font-bold">Daftar Episode</p>
                      <p className="text-[11px] text-white/45">
                        {title} · {episodes.length} episode
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEpisodeMenuOpen(false)}
                      className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
                      aria-label="Tutup daftar episode"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {episodes.map((episode: any, index: number) => {
                      const number = episodeNumber(episode, index);

                      return (
                        <button
                          key={
                            String(episode?.id ?? chapterIdOf(episode) ?? number) +
                            "-" +
                            index
                          }
                          type="button"
                          onClick={() => playEpisode(episode, index)}
                          className={
                            "rounded-lg border px-2 py-2.5 text-xs font-bold transition-colors " +
                            (number === selectedEpisode
                              ? "border-purple-400 bg-purple-600 text-white"
                              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
                          }
                        >
                          {number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="border-t border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Desktop episode list stays outside the player */}
        {episodes.length > 0 && (
          <div className="hidden max-h-32 overflow-y-auto border-t border-white/10 bg-[#0a0e27] p-3 md:block">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-white/50">
                {title} · Episode
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!previousEpisode}
                  onClick={() =>
                    previousEpisode &&
                    playEpisode(previousEpisode, selectedIndex - 1)
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 disabled:opacity-30"
                >
                  ← Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={!nextEpisode}
                  onClick={() =>
                    nextEpisode &&
                    playEpisode(nextEpisode, selectedIndex + 1)
                  }
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
                >
                  Berikutnya →
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {episodes.map((episode: any, index: number) => {
                const number = episodeNumber(episode, index);

                return (
                  <button
                    key={String(episode?.id ?? number) + "-" + index}
                    type="button"
                    onClick={() => playEpisode(episode, index)}
                    className={
                      "rounded-lg border px-3 py-2 text-xs font-semibold " +
                      (number === selectedEpisode
                        ? "border-purple-400 bg-purple-600 text-white"
                        : "border-white/10 bg-white/5 text-white/70")
                    }
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
