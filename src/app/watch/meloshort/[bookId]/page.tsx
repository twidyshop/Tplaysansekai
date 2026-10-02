"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

export default function MeloShortWatchPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;

  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  // 1. Ambil detail drama untuk mendapatkan daftar/jumlah episode asli
  const { data: detailData, isLoading: loadingDetail } = useQuery({
    queryKey: ["meloshort-watch-detail", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/meloshort?path=/api/v2/detail&id=${bookId}`);
      if (!res.ok) throw new Error("Gagal mengambil detail drama");
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!bookId,
  });

  // Ekstrak daftar episode asli dari respons API detail
  const rawEpisodes = detailData?.episodes || detailData?.chapterList || detailData?.videoList || detailData?.list || [];
  
  // Tentukan total episode dinamis (jika array kosong, cek total/episodesCount, minimal 1)
  const totalEpisodes = rawEpisodes.length > 0 
    ? rawEpisodes.length 
    : (detailData?.totalEpisodes || detailData?.episodeCount || detailData?.total || 30);

  // Tentukan chapter_id yang dikirim ke API /api/v2/video (biasanya urutan 1, 2, 3... atau ID khusus chapter)
  const currentEpItem = rawEpisodes[currentEpisodeIndex];
  const chapterId = currentEpItem 
    ? (currentEpItem.id || currentEpItem.chapterId || currentEpItem.episodeId || currentEpisodeIndex + 1) 
    : currentEpisodeIndex + 1;

  // 2. Ambil URL video streaming dari endpoint /api/v2/video
  const { data: videoData, isLoading: loadingVideo } = useQuery({
    queryKey: ["meloshort-watch-video", bookId, chapterId],
    queryFn: async () => {
      const res = await fetch(`/api/meloshort?path=/api/v2/video&id=${bookId}&chapter_id=${chapterId}`);
      if (!res.ok) throw new Error("Gagal mengambil stream video");
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!bookId && !!chapterId,
  });

  const streams = videoData?.streams || videoData?.videoList || [];
  const videoUrl = videoData?.url || streams[0]?.url || videoData?.videoUrl || "";

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
            <div className="text-zinc-400 animate-pulse">Memuat video episode {currentEpisodeIndex + 1}...</div>
          ) : videoUrl ? (
            <video
              key={videoUrl}
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
          <h1 className="text-xl font-bold">{detailData?.title || detailData?.bookName || "MeloShort Video"}</h1>
          <p className="text-sm text-zinc-400 mt-1">Episode {currentEpisodeIndex + 1}</p>
        </div>
      </div>

      {/* Sidebar Daftar Episode Dinamis */}
      <div className="w-full md:w-80 bg-zinc-900 border-t md:border-t-0 md:border-l border-zinc-800 p-4 flex flex-col max-h-screen overflow-y-auto">
        <h2 className="font-semibold text-lg mb-4">Daftar Episode ({totalEpisodes})</h2>
        <div className="grid grid-cols-5 md:grid-cols-3 gap-2">
          {Array.from({ length: totalEpisodes }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentEpisodeIndex(idx)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition ${
                currentEpisodeIndex === idx
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
