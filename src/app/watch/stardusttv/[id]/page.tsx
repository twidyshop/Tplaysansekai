"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  extractStardustEpisodes,
  extractStardustStream,
  extractStardustText,
  getStardustTVStream,
  useStardustTVDetail,
} from "@/hooks/useStardustTV";

export default function StardustTVWatchPage() {
  const params = useParams();
  const id = String(params.id || "");

  const videoRef = useRef<HTMLVideoElement>(null);

  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState("");

  const detailQuery = useStardustTVDetail(id);

  const detail = detailQuery.data;
  const title = extractStardustText(
    detail,
    ["title", "bookName", "book_name", "dramaName", "name"],
    "StardustTV",
  );

  const episodes = extractStardustEpisodes(detail);

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

    if (Number.isFinite(firstNumber) && firstNumber > 0) {
      setSelectedEpisode(firstNumber);
    }
  }, [episodes]);

  useEffect(() => {
    let cancelled = false;

    async function loadVideo() {
      setError("");
      setStreamUrl("");

      try {
        const response = await getStardustTVStream(
          id,
          String(selectedEpisode),
        );

        const source = extractStardustStream(response);

        if (!source) {
          throw new Error("URL video StardustTV tidak ditemukan.");
        }

        if (!cancelled) {
          setStreamUrl(source);
        }
      } catch (streamError: unknown) {
        if (!cancelled) {
          setError(
            streamError instanceof Error
              ? streamError.message
              : "Gagal mengambil video StardustTV.",
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
  }, [id, selectedEpisode]);

  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;

    videoRef.current.src =
      "/api/stardusttv/stream?url=" +
      encodeURIComponent(streamUrl);
    videoRef.current.load();
  }, [streamUrl]);

  return (
    <main className="fixed inset-0 flex flex-col bg-black text-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black px-4">
        <Link href="/" className="text-sm font-semibold">
          TPLAY
        </Link>

        <Link
          href={"/detail/stardusttv/" + encodeURIComponent(id)}
          className="text-sm text-white/70"
        >
          Detail
        </Link>
      </header>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
          <video
            ref={videoRef}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
        </div>

        {error && (
          <div className="border-t border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {episodes.length > 0 && (
          <div className="max-h-32 overflow-y-auto border-t border-white/10 bg-[#0a0e27] p-3">
            <div className="mb-2 text-xs font-semibold text-white/50">
              {title} · Episode
            </div>

            <div className="flex flex-wrap gap-2">
              {episodes.map((episode: any, index: number) => {
                const number = Number(
                  episode?.episode ??
                    episode?.episodeNumber ??
                    episode?.episode_index ??
                    episode?.index ??
                    index + 1,
                );

                return (
                  <button
                    key={String(episode?.id ?? number) + "-" + index}
                    type="button"
                    onClick={() => setSelectedEpisode(number)}
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
