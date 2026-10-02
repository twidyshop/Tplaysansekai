"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

export default function MeloShortWatchPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;

  const [currentEpisode, setCurrentEpisode] = useState(0);

  // Ambil detail drama untuk mendapatkan list episode
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["meloshort-watch-detail", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/meloshort?path=/api/v2/detail&id=${bookId}`);
      if (!res.ok) throw new Error("Gagal mengambil detail drama");
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!bookId,
  });

  const episodes = detail?.episodes || detail?.chapterList || detail?.videoList || [];
  const currentEpData = episodes[currentEpisode] || {};
  const episodeId = currentEpData.id || currentEpData.episodeId || currentEpData.chapterId || "";

  // Ambil URL video streaming menggunakan endpoint /api/v2/video berdasarkan episode
  const { data: videoData, isLoading: loadingVideo } = useQuery({
    queryKey: ["meloshort-watch-video", bookId, episodeId],
    queryFn: async () => {
      const res = await fetch(`/api/meloshort?path=/api/v2/video&id=${bookId}&episode_id=${episodeId}`);
      if (!res.ok) throw new Error("Gagal mengambil stream video");
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!bookId && !!episodeId,
  });

  const videoUrl = videoData?.videoUrl || videoData?.url || videoData?.playUrl || currentEpData.videoUrl || "";

  if (loadingDetail) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="animate-pulse text-lg">Memuat pemutar video MeloShort...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      {/* Area Pemutar Video Utama */}
      <div className="flex-1 flex flex-col justify-center items-center bg-zinc-950 p-4 relative">
        <button 
          onClick={() => router.back()} 
          className="absolute top-4 left-4 z-10 px-4 py-2 bg-zinc-800/80 backdrop-blur rounded-xl text-sm font-medium hover:bg-zinc-700 transition"
        >
          ← Kembali
        </button>

        <div className="w-full max-w-4xl aspect-[9/16] md:aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-zinc-800 relative">
          {loadingVideo ? (
            <div className="text-zinc-400 animate-pulse">Memuat video episode...</div>
          ) : videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-zinc-500 text-center p-6">
              <p>URL video tidak tersedia untuk episode ini.</p>
            </div>
          )}
        </div>

        <div className="w-full max-w-4xl mt-4 px-2">
          <h1 className="text-xl font-bold">{detail?.title || detail?.bookName || "MeloShort Video"}</h1>
          <p className="text-sm text-zinc-400 mt-1">Episode {currentEpisode + 1}</p>
        </div>
      </div>

      {/* Sidebar Daftar Episode */}
      <div className="w-full md:w-80 bg-zinc-900 border-t md:border-t-0 md:border-l border-zinc-800 p-4 flex flex-col max-h-screen overflow-y-auto">
        <h2 className="font-semibold text-lg mb-4">Daftar Episode</h2>
        <div className="grid grid-cols-5 md:grid-cols-3 gap-2">
          {episodes.map((ep: any, idx: number) => (
            <button
              key={idx}
              onClick={() => setCurrentEpisode(idx)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition ${
                currentEpisode === idx
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/50"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
