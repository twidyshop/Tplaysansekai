"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Hls from "hls.js";

type MeloFfmpeg = {
  loaded: boolean;
  on: (event: "log", callback: (data: { message: string }) => void) => void;
  load: (config: { coreURL: string; wasmURL: string; workerLoadURL: string }) => Promise<boolean>;
  writeFile: (path: string, data: Uint8Array) => Promise<boolean>;
  exec: (args: string[], timeout?: number) => Promise<number>;
  readFile: (path: string) => Promise<Uint8Array | string>;
  deleteFile: (path: string) => Promise<boolean>;
  terminate: () => void;
};

declare global {
  interface Window {
    FFmpegWASM?: { FFmpeg: new () => MeloFfmpeg };
  }
}

let meloshortFfmpegPromise: Promise<MeloFfmpeg> | null = null;

async function toMeloBlobURL(url: string, type: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Gagal mengambil FFmpeg resource (${response.status}).`);
  const blob = await response.blob();
  return URL.createObjectURL(new Blob([blob], { type }));
}

async function loadMeloShortFfmpeg(): Promise<MeloFfmpeg> {
  if (meloshortFfmpegPromise) return meloshortFfmpegPromise;

  meloshortFfmpegPromise = (async () => {
    const ffmpegBase = "https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/umd";
    const coreBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

    if (!window.FFmpegWASM?.FFmpeg) {
      const sourceResponse = await fetch(`${ffmpegBase}/ffmpeg.js`);
      if (!sourceResponse.ok) throw new Error("Gagal memuat FFmpeg player.");
      let source = await sourceResponse.text();
      source = source.replace("new URL(e.p+e.u(814),e.b)", "r.workerLoadURL");

      const moduleUrl = URL.createObjectURL(
        new Blob([source], { type: "text/javascript" })
      );

      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = moduleUrl;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("FFmpeg UMD gagal dimuat."));
        document.head.appendChild(script);
      });
    }

    if (!window.FFmpegWASM?.FFmpeg) {
      throw new Error("FFmpeg player tidak tersedia di browser.");
    }

    const ffmpeg = new window.FFmpegWASM.FFmpeg();
    const coreURL = await toMeloBlobURL(`${coreBase}/ffmpeg-core.js`, "text/javascript");
    const wasmURL = await toMeloBlobURL(`${coreBase}/ffmpeg-core.wasm`, "application/wasm");
    const workerLoadURL = await toMeloBlobURL(`${ffmpegBase}/814.ffmpeg.js`, "text/javascript");

    await ffmpeg.load({ coreURL, wasmURL, workerLoadURL });
    return ffmpeg;
  })().catch((error) => {
    meloshortFfmpegPromise = null;
    throw error;
  });

  return meloshortFfmpegPromise;
}

async function transcodeMeloShortHlsToMp4(
  hlsUrl: string,
  onProgress?: (message: string) => void
) {
  const proxyUrl = "/api/meloshort/stream?url=" + encodeURIComponent(hlsUrl);
  const playlistResponse = await fetch(proxyUrl, { cache: "no-store" });
  if (!playlistResponse.ok) {
    throw new Error(`Playlist MeloShort gagal diambil (${playlistResponse.status}).`);
  }

  const playlist = await playlistResponse.text();
  const segmentUrls = playlist
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (!segmentUrls.length) {
    throw new Error("Playlist MeloShort tidak memiliki segment video.");
  }

  onProgress?.(`Mengambil video MeloShort (0/${segmentUrls.length})...`);

  const segments: Uint8Array[] = [];
  for (let index = 0; index < segmentUrls.length; index += 1) {
    const response = await fetch(segmentUrls[index], { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Segment video gagal diambil (${response.status}).`);
    }
    segments.push(new Uint8Array(await response.arrayBuffer()));
    onProgress?.(`Mengambil video MeloShort (${index + 1}/${segmentUrls.length})...`);
  }

  const totalSize = segments.reduce((sum, segment) => sum + segment.byteLength, 0);
  const input = new Uint8Array(totalSize);
  let offset = 0;
  for (const segment of segments) {
    input.set(segment, offset);
    offset += segment.byteLength;
  }

  onProgress?.("Menyiapkan decoder HEVC...");
  const ffmpeg = await loadMeloShortFfmpeg();
  await ffmpeg.writeFile("meloshort.ts", input);
  onProgress?.("Mengonversi HEVC → H.264...");

  const exitCode = await ffmpeg.exec([
    "-i", "meloshort.ts",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "28",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "meloshort.mp4",
  ]);

  if (exitCode !== 0) {
    throw new Error("FFmpeg gagal mengonversi video HEVC MeloShort.");
  }

  const output = await ffmpeg.readFile("meloshort.mp4");
  const bytes = typeof output === "string" ? new TextEncoder().encode(output) : output;
  return URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
}
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

  const getTitle = (value: any): string => {
    const keys = ["title","bookName","book_name","dramaName","drama_name","name"];
    const bad = new Set(["drama pilihan","meloshort","untitled","drama"]);
    const out: string[] = [];
    const walk = (node: any, depth = 0) => {
      if (!node || typeof node !== "object" || depth > 5) return;
      if (Array.isArray(node)) return node.forEach((x) => walk(x, depth + 1));
      for (const key of keys) if (typeof node[key] === "string" && node[key].trim()) out.push(node[key].trim());
      for (const key of ["data","detail","book","drama","result"]) if (node[key] && typeof node[key] === "object") walk(node[key], depth + 1);
    };
    walk(value);
    return out.find((x) => !bad.has(x.toLowerCase())) || "";
  };

  const title = getTitle(detail);
  const cover = extractMeloShortText(detail, ["cover","coverUrl","cover_url","poster","posterUrl","poster_url","image","imageUrl","image_url","thumbnail","thumbnailUrl","book_pic"], "");
  const episodes = extractMeloShortEpisodes(detail);

  useEffect(() => {
    if (!episodes.length) return;
    const first = episodes[0];
    const number = Number(first?.episode ?? first?.episodeNumber ?? first?.episode_index ?? first?.index ?? 1);
    const chapter = String(first?.id ?? first?.chapterId ?? first?.chapter_id ?? first?.videoId ?? first?.video_id ?? "");
    if (Number.isFinite(number) && number > 0) setSelectedEpisode(number);
    if (chapter) setSelectedChapterId(chapter);
  }, [episodes]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      setStreamUrl("");
      if (!selectedChapterId) return;
      try {
        const response = await getMeloShortStream(id, selectedChapterId);
        const source = extractMeloShortStream(response);
        if (!source) throw new Error("URL video MeloShort tidak ditemukan.");
        if (!cancelled) setStreamUrl(source);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal mengambil video MeloShort.");
      }
    }
    if (id) void load();
    return () => { cancelled = true; };
  }, [id, selectedEpisode, selectedChapterId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const proxyUrl = "/api/meloshort/stream?url=" + encodeURIComponent(streamUrl);
    let hls: Hls | null = null;
    let cancelled = false;
    let generatedUrl = "";

    const playWithFfmpegFallback = async () => {
      try {
        setError("MeloShort memakai HEVC. Menyiapkan player kompatibel...");
        generatedUrl = await transcodeMeloShortHlsToMp4(streamUrl, (message) => {
          if (!cancelled) setError(message);
        });
        if (cancelled) {
          URL.revokeObjectURL(generatedUrl);
          return;
        }
        setError("");
        video.src = generatedUrl;
        video.load();
        await video.play().catch(() => {});
      } catch (fallbackError) {
        if (!cancelled) {
          console.error("[MELOSHORT FFMPEG FALLBACK]", fallbackError);
          setError(
            fallbackError instanceof Error
              ? fallbackError.message
              : "Video MeloShort gagal dikonversi ke format yang didukung browser."
          );
        }
      }
    };

    // Safari/iOS can play HEVC HLS natively. Chrome/Windows uses hls.js first;
    // if MSE rejects HEVC, it falls back to client-side H.264 transcoding.
    const isAppleBrowser =
      /Mobi|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      /Macintosh/i.test(navigator.userAgent);

    if (isAppleBrowser) {
      video.src = proxyUrl;
      video.load();
      void video.play().catch(() => {});
    } else if (/\.m3u8(?:$|[?#])/i.test(streamUrl) && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        capLevelToPlayerSize: false,
        autoStartLoad: true,
        startLevel: 0,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 3,
      });

      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.startLoad(0));
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error("[MELOSHORT HLS ERROR]", data);
        if (
          data.fatal &&
          (data.details === "bufferAddCodecError" ||
            data.details === "bufferAppendError" ||
            data.type === Hls.ErrorTypes.MEDIA_ERROR)
        ) {
          hls?.destroy();
          hls = null;
          void playWithFfmpegFallback();
        } else if (data.fatal) {
          setError("Video MeloShort gagal dimuat: " + (data.details || "HLS error"));
        }
      });

      hls.attachMedia(video);
      hls.loadSource(proxyUrl);
    } else {
      video.src = proxyUrl;
      video.load();
    }

    return () => {
      cancelled = true;
      hls?.destroy();
      hls = null;
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
      video.removeAttribute("src");
      video.load();
    };
  }, [streamUrl]);

  useEffect(() => {
    if (!id || !title || !episodes.length) return;
    addHistory({
      id, title, image: cover, platform: "MeloShort", timestamp: Date.now(),
      url: "/watch/meloshort/" + encodeURIComponent(id),
      episode: selectedEpisode, totalEpisodes: episodes.length,
    });
  }, [id, title, cover, selectedEpisode, episodes.length, addHistory]);

  const selectedIndex = episodes.findIndex((episode: any, index: number) => {
    const number = Number(episode?.episode ?? episode?.episodeNumber ?? episode?.episode_index ?? episode?.index ?? index + 1);
    return number === selectedEpisode;
  });
  const previousEpisode = selectedIndex > 0 ? episodes[selectedIndex - 1] : null;
  const nextEpisode = selectedIndex >= 0 && selectedIndex < episodes.length - 1 ? episodes[selectedIndex + 1] : null;
  const episodeNumber = (episode: any, index: number) => Number(episode?.episode ?? episode?.episodeNumber ?? episode?.episode_index ?? episode?.index ?? index + 1);
  const chapterIdOf = (episode: any) => String(episode?.id ?? episode?.chapterId ?? episode?.chapter_id ?? episode?.videoId ?? episode?.video_id ?? "");
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
        <Link href="/" className="text-sm font-semibold">TPLAY</Link>
        <Link href={"/detail/meloshort/" + encodeURIComponent(id)} className="text-sm text-white/70">Detail</Link>
      </header>
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          <video ref={videoRef} controls playsInline className="h-full w-full object-contain" />
          {episodes.length > 0 && (
            <>
              <button type="button" onClick={() => setEpisodeMenuOpen((open) => !open)} className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md md:hidden" aria-label="Buka daftar episode">
                {episodeMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}<span>Ep {selectedEpisode}</span>
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center gap-3 md:hidden">
                <button type="button" disabled={!previousEpisode} onClick={() => previousEpisode && playEpisode(previousEpisode, selectedIndex - 1)} className="pointer-events-auto flex h-10 items-center gap-1 rounded-full border border-white/20 bg-black/70 px-4 text-xs font-semibold text-white backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Sebelumnya</button>
                <button type="button" disabled={!nextEpisode} onClick={() => nextEpisode && playEpisode(nextEpisode, selectedIndex + 1)} className="pointer-events-auto flex h-10 items-center gap-1 rounded-full border border-white/20 bg-black/70 px-4 text-xs font-semibold text-white backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-30">Berikutnya<ChevronRight className="h-4 w-4" /></button>
              </div>
              {episodeMenuOpen && (
                <div className="absolute inset-x-3 top-14 z-30 max-h-[65%] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e27]/95 p-3 shadow-2xl backdrop-blur-xl md:hidden">
                  <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-sm font-bold">Daftar Episode</p><p className="text-[11px] text-white/45">{title} · {episodes.length} episode</p></div><button type="button" onClick={() => setEpisodeMenuOpen(false)} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Tutup daftar episode"><X className="h-4 w-4" /></button></div>
                  <div className="grid grid-cols-5 gap-2">{episodes.map((episode: any, index: number) => { const number = episodeNumber(episode,index); return <button key={String(episode?.id ?? chapterIdOf(episode) ?? number)+"-"+index} type="button" onClick={() => playEpisode(episode,index)} className={"rounded-lg border px-2 py-2.5 text-xs font-bold transition-colors "+(number===selectedEpisode?"border-purple-400 bg-purple-600 text-white":"border-white/10 bg-white/5 text-white/70 hover:bg-white/10")}>{number}</button>; })}</div>
                </div>
              )}
            </>
          )}
        </div>
        {error && <div className="border-t border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">{error}</div>}
        {episodes.length > 0 && (
          <div className="hidden max-h-32 overflow-y-auto border-t border-white/10 bg-[#0a0e27] p-3 md:block">
            <div className="mb-2 flex items-center justify-between gap-3"><div className="text-xs font-semibold text-white/50">{title} · Episode</div><div className="flex gap-2"><button type="button" disabled={!previousEpisode} onClick={() => previousEpisode && playEpisode(previousEpisode,selectedIndex-1)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 disabled:opacity-30">← Sebelumnya</button><button type="button" disabled={!nextEpisode} onClick={() => nextEpisode && playEpisode(nextEpisode,selectedIndex+1)} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30">Berikutnya →</button></div></div>
            <div className="flex flex-wrap gap-2">{episodes.map((episode:any,index:number)=>{const number=episodeNumber(episode,index);return <button key={String(episode?.id??number)+"-"+index} type="button" onClick={()=>playEpisode(episode,index)} className={"rounded-lg border px-3 py-2 text-xs font-semibold "+(number===selectedEpisode?"border-purple-400 bg-purple-600 text-white":"border-white/10 bg-white/5 text-white/70")}>{number}</button>;})}</div>
          </div>
        )}
      </section>
    </main>
  );
}
