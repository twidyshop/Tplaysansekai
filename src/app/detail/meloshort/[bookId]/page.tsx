"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

export default function MeloShortDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ["meloshort-detail-page", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/meloshort?path=/api/v2/detail&id=${bookId}&lang=id`);
      if (!res.ok) throw new Error("Gagal mengambil detail MeloShort");
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!bookId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="animate-pulse text-lg">Memuat detail drama...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <p className="text-red-500 mb-4 text-lg font-semibold">Drama tidak ditemukan</p>
        <p className="text-zinc-400 text-sm mb-6">Tidak dapat memuat detail drama. Silakan coba lagi atau kembali ke beranda.</p>
        <button 
          onClick={() => router.push("/")} 
          className="px-6 py-2.5 bg-purple-600 rounded-xl font-medium hover:bg-purple-700 transition"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const title = detail.title || detail.bookName || "Judul Tidak Tersedia";
  const cover = detail.cover || detail.image || detail.coverWap || "";
  const description = detail.description || detail.introduction || detail.desc || "Tidak ada deskripsi.";
  const tags = detail.tags || detail.tagNames || detail.book_theme || [];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <button 
        onClick={() => router.back()} 
        className="mb-6 px-4 py-2 bg-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-700 transition"
      >
        ← Kembali
      </button>

      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
        <div className="w-full md:w-72 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl relative flex-shrink-0 bg-zinc-800">
          {cover ? (
            <img src={cover} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">No Image</div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3">{title}</h1>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {Array.isArray(tags) && tags.map((tag: string, idx: number) => (
                <span key={idx} className="px-3 py-1 bg-purple-950/60 text-purple-300 border border-purple-800/50 rounded-full text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>

            <p className="text-zinc-300 text-sm leading-relaxed mb-6">{description}</p>
          </div>

          <button
            onClick={() => router.push(`/watch/meloshort/${bookId}`)}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
          >
            ▶ Mulai Nonton
          </button>
        </div>
      </div>
    </div>
  );
}
