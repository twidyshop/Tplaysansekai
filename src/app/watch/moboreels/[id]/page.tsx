"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useMoboReelsDetail,
  useMoboReelsEpisodes,
  useMoboReelsPlay,
} from "@/hooks/useMoboReels";

function arr(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object") return [];
  for (const k of [
    "data",
    "episodes",
    "episodeList",
    "episode_list",
    "episodeData",
    "episode_data",
    "list",
    "rows",
    "results",
    "items",
    "chapters",
    "videos",
    "result",
  ]) {
    const n = arr(v[k]);
    if (n.length) return n;
  }
  return [];
}

function p(v: any, keys: string[], f = "") {
  for (const x of keys) {
    const a = v?.[x];
    if (typeof a === "string" && a.trim()) return a.trim();
    if (typeof a === "number") return String(a);
  }
  return f;
}

function d(v: any, keys: string[], f = "", n = 0): string {
  if (n > 12 || v == null) return f;
  const x = p(v, keys, "");
  if (x) return x;
  if (typeof v !== "object") return f;
  for (const q of Object.keys(v)) {
    const z = d(v[q], keys, "", n + 1);
    if (z) return z;
  }
  return f;
}

function stream(v: any, n = 0): string {
  if (n > 12 || v == null) return "";
  const x = p(
    v,
    [
      "hlsUrl",
      "hls",
      "m3u8",
      "streamUrl",
      "stream_url",
      "playUrl",
      "play_url",
      "videoUrl",
      "video_url",
      "MainPlayUrl",
      "mainPlayUrl",
      "url",
    ],
    ""
  );
  if (/^https?:\/\//i.test(x) || x.includes(".m3u8")) return x;
  if (typeof v !== "object") return "";
  for (const q of Object.keys(v)) {
    const z = stream(v[q], n + 1);
    if (z) return z;
  }
  return "";
}

function subtitleUrl(v: any, n = 0): string {
  if (n > 12 || v == null) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (/^https?:\/\//i.test(s) && /\.(vtt|srt)(?:$|[?#])/i.test(s)) return s;
    return "";
  }
  if (typeof v !== "object") return "";
  for (const key of [
    "subtitle",
    "subtitles",
    "subtitleUrl",
    "subtitle_url",
    "subUrl",
    "sub_url",
    "caption",
    "captionUrl",
    "caption_url",
    "vtt",
    "vttUrl",
    "vtt_url",
    "webvtt",
    "webvttUrl",
    "url",
  ]) {
    const found = subtitleUrl(v[key], n + 1);
    if (found) return found;
  }
  for (const key of Object.keys(v)) {
    const found = subtitleUrl(v[key], n + 1);
    if (found) return found;
  }
  return "";
}

function parseTime(s: string) {
  const parts = s.replace(",", ".").trim().split(":");
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function parseVtt(text: string) {
  const clean = text.replace(/^WEBVTT[^\n]*\n/i, "");
  return clean
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const timing = lines.find((line) => line.includes("-->"));
      if (!timing) return null;
      const [start, end] = timing.split("-->");
      const startTime = parseTime(start);
      const endTime = parseTime(end.split(" ")[0]);
      const text = lines
        .slice(lines.indexOf(timing) + 1)
        .join("\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (!text || !Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
      return { startTime, endTime, text };
    })
    .filter(Boolean) as { startTime: number; endTime: number; text: string }[];
}

export default function MoboReelsWatch() {
  const { id } = useParams();
  const router = useRouter();
  const sid = String(id || "");
  const [ep, setEp] = useState(1);
  const [src, setSrc] = useState("");
  const [subUrl, setSubUrl] = useState("");
  const [subText, setSubText] = useState("");
  const [err, setErr] = useState("");
  const [currentTime, setCurrentTime] = useState(0);\n  const [showEpisodes, setShowEpisodes] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);

  const detail = useMoboReelsDetail(sid);
  const eps = useMoboReelsEpisodes(sid);
  const play = useMoboReelsPlay(sid, ep);

  const list = useMemo(
    () =>
      arr(eps.data).map((x: any, i: number) => ({
        id: p(x, ["id", "episodeId", "episode_id"], String(i + 1)),
        n:
          Number(
            x?.episode ??
              x?.episodeNumber ??
              x?.episode_index ??
              x?.num ??
              i + 1
          ) || i + 1,
      })),
    [eps.data]
  );

  const title = d(detail.data, ["title", "name", "bookName", "albumName"], "MoboReels");

  useEffect(() => {
    const s = stream(play.data);
    const sub = subtitleUrl(play.data);
    if (s) {
      setSrc(s);
      setErr("");
    } else if (play.isError) {
      setErr(play.error instanceof Error ? play.error.message : "Gagal memutar MoboReels");
    }
    setSubUrl(sub);
    setSubText("");
  }, [play.data, play.isError, play.error]);

  useEffect(() => {
    if (!subUrl) return;
    let cancelled = false;
    fetch("/api/moboreels/proxy?url=" + encodeURIComponent(subUrl))
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        if (!cancelled) setSubText(text);
      })
      .catch(() => {
        if (!cancelled) setSubText("");
      });
    return () => {
      cancelled = true;
    };
  }, [subUrl]);

  const cues = useMemo(() => parseVtt(subText), [subText]);

  useEffect(() => {
    if (!video.current || !src) return;
    const u = "/api/moboreels/proxy?url=" + encodeURIComponent(src);
    video.current.src = u;
    video.current.load();
    void video.current.play().catch(() => {});
    return () => video.current?.pause();
  }, [src]);

  const activeSub = useMemo(
    () => cues.find((cue) => currentTime >= cue.startTime && currentTime <= cue.endTime)?.text || "",
    [cues, currentTime]
  );

  return (
    <main className="min-h-screen bg-[#0a0e27] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e27]/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <button onClick={() => router.back()} className="text-sm text-white/70">
            ‹&nbsp; Kembali
          </button>
          <Link
            href={"/detail/moboreels/" + encodeURIComponent(sid)}
            className="text-sm text-white/70"
          >
            Detail
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5">
        <div className="mx-auto w-full max-w-[430px]">
          <div className="relative aspect-[9/16] max-h-[78vh] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            <video
              ref={video}
              className="h-full w-full object-contain"
              controls
              playsInline
              preload="auto"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
            {activeSub && (
              <div className="pointer-events-none absolute inset-x-3 bottom-14 z-10 text-center">
                <span className="inline-block max-w-full whitespace-pre-line rounded-md bg-black/70 px-2.5 py-1 text-base font-semibold leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,1),0_0_4px_rgba(0,0,0,1)] sm:text-lg">
                  {activeSub}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-4xl">
          <h1 className="mt-5 text-xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-white/45">Episode {ep}</p>

          {play.isLoading && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Menyiapkan video MoboReels...
            </div>
          )}

          {err && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
              {err}
            </div>
          )}

          <section className="mt-7">
            <h2 className="mb-3 text-lg font-bold">Episode</h2>
            {eps.isLoading ? (
              <p className="text-sm text-white/45">Memuat episode...</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                {list.map((x) => (
                  <button
                    key={x.id + "-" + x.n}
                    onClick={() => {
                      setEp(x.n);
                      setSrc("");
                      setErr("");
                      setSubUrl("");
                      setSubText("");
                      setCurrentTime(0);
                    }}
                    className={
                      "rounded-lg border px-3 py-2 text-sm font-semibold " +
                      (x.n === ep
                        ? "border-amber-300 bg-amber-400 text-black"
                        : "border-white/10 bg-white/5 text-white/75")
                    }
                  >
                    {x.n}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
