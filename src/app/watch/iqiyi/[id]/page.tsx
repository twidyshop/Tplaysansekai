"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Hls from "hls.js";

interface Episode {
  id: string;
  number: number;
  title: string;
  [key: string]: any;
}

function findArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["data", "episodes", "list", "rows", "results", "items", "chapters"]) {
    if (Array.isArray(value[key])) return value[key];
    const nested = findArray(value[key]);
    if (nested.length) return nested;
  }
  return [];
}

function text(value: any, keys: string[], fallback = "") {
  for (const key of keys) {
    const v = value?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

function getEpisode(item: any, index: number): Episode {
  return {
    id: text(item, ["id", "episodeId", "episode_id", "chapterId", "chapter_id"], String(index + 1)),
    number: Number(item?.episode ?? item?.episodeNumber ?? item?.episode_index ?? item?.index ?? index + 1) || index + 1,
    title: text(item, ["title", "name", "episodeTitle", "chapterName", "chapter_name"], "Episode " + (index + 1)),
    ...item,
  };
}

function findVideo(value: any): string {
  if (!value || typeof value !== "object") return "";
  for (const key of ["hls", "m3u8", "url", "videoUrl", "playUrl", "streamUrl", "fileUrl"]) {
    if (typeof value[key] === "string" && value[key].includes("http")) return value[key];
  }
  for (const key of ["data", "stream", "video", "play", "result"]) {
    const nested = findVideo(value[key]);
    if (nested) return nested;
  }
  return "";
}

export default function IqiyiWatchPage() {
  const params = useParams();
  const id = String(params.id || "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [current, setCurrent] = useState(0);
  const [title, setTitle] = useState("iQIYI");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const playEpisode = useCallback(async (index: number, list?: Episode[]) => {
    const source = list || episodes;
    const episode = source[index];
    if (!episode) return;

    setCurrent(index);
    setLoading(true);
    setError("");
    destroyHls();

    try {
      const response = await fetch(
        "/api/iqiyi?action=play&id=" + encodeURIComponent(id) + "&episode=" + encodeURIComponent(episode.id || episode.number),
        { cache: "no-store" }
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Gagal mengambil video IQIYI");

      const url = findVideo(json);
      if (!url) throw new Error("URL video IQIYI tidak ditemukan.");

      const video = videoRef.current;
      if (!video) return;

      if (Hls.isSupported() && url.includes(".m3u8")) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) {
            setLoading(false);
            setError("Gagal memutar video IQIYI.");
          }
        });
      } else {
        video.src = url;
        video.load();
        video.play().catch(() => {});
        setLoading(false);
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Gagal memutar episode.");
    }
  }, [destroyHls, episodes, id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/iqiyi?action=episodes&id=" + encodeURIComponent(id), { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error || "Gagal mengambil episode IQIYI");

        const list = findArray(json).map(getEpisode);
        if (!list.length) throw new Error("Episode IQIYI tidak tersedia.");
        if (cancelled) return;

        setEpisodes(list);

        const detailResponse = await fetch("/api/iqiyi?action=detail&id=" + encodeURIComponent(id), { cache: "no-store" });
        if (detailResponse.ok) {
          const detailJson = await detailResponse.json();
          const detail = detailJson?.data ?? detailJson;
          const foundTitle = text(detail, ["title", "name", "bookName", "albumName"], "");
          if (foundTitle) setTitle(foundTitle);
        }

        await playEpisode(0, list);
      } catch (err: any) {
        if (!cancelled) {
          setLoading(false);
          setError(err?.message || "Gagal memuat IQIYI.");
        }
      }
    }

    if (id) load();

    return () => {
      cancelled = true;
      destroyHls();
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [destroyHls, id, playEpisode]);

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-black text-white">
      <header className="z-50 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#05070b] px-4">
        <Link href={"/detail/iqiyi/" + encodeURIComponent(id)} className="max-w-[75%] truncate font-bold">‹&nbsp; {title}</Link>
        <span className="text-xs text-white/50">iQIYI</span>
      </header>

      <section className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
        <video
          ref={videoRef}
          controls
          playsInline
          className="h-full w-full object-contain"
          onEnded={() => {
            const next = current + 1;
            if (next < episodes.length) playEpisode(next);
          }}
        />

        {loading && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-5 text-center">
            <div>
              <p className="mb-4 text-sm text-red-300">{error}</p>
              <button onClick={() => playEpisode(current)} className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black">Coba lagi</button>
            </div>
          </div>
        )}
      </section>

      <aside className="max-h-[30vh] shrink-0 overflow-x-auto border-t border-white/10 bg-[#080a10] p-3">
        <div className="flex gap-2">
          {episodes.map((episode, index) => (
            <button
              key={episode.id + "-" + index}
              onClick={() => playEpisode(index)}
              className={"shrink-0 rounded-lg px-3 py-2 text-xs font-semibold " + (index === current ? "bg-emerald-500 text-black" : "bg-white/5 text-white/70")}
            >
              Ep {episode.number}
            </button>
          ))}
        </div>
      </aside>
    </main>
  );
}
