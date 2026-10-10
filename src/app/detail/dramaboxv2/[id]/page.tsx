"use client";
import { useParams, useRouter } from "next/navigation";
import { useDramaBoxV2Detail, extractDramaBoxV2Text } from "@/hooks/useDramaBoxV2";

export default function DramaBoxV2DetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");
  const query = useDramaBoxV2Detail(id);
  const data = query.data;
  const title = extractDramaBoxV2Text(data, ["bookName", "title", "name", "dramaName"], "DramaBox V2");
  const cover = extractDramaBoxV2Text(data, ["cover", "coverUrl", "coverWap", "poster", "image", "thumbUrl"], "");
  const description = extractDramaBoxV2Text(data, ["introduction", "description", "synopsis", "desc", "summary"], "");
  const count = extractDramaBoxV2Text(data, ["chapterCount", "episodeCount", "totalEpisodes"], "");
  return <main className="min-h-screen bg-[#0a0e27] px-4 py-20 text-white"><div className="mx-auto max-w-5xl"><button onClick={() => router.back()} className="mb-6 text-white/70">‹ Kembali</button>{query.isLoading ? <p>Memuat detail DramaBox V2...</p> : query.error ? <p className="text-red-300">Gagal memuat detail: {(query.error as Error).message}</p> : <div className="grid gap-7 md:grid-cols-[280px_1fr]">{cover && <img src={cover} alt={title} className="w-full max-w-[280px] rounded-2xl object-cover" /> }<section><span className="text-sm text-purple-300">DramaBox V2</span><h1 className="my-3 text-3xl font-bold">{title}</h1>{count && <p className="mb-4 text-white/50">{count} episode</p>}{description && <p className="mb-6 whitespace-pre-line leading-7 text-white/65">{description}</p>}<button onClick={() => router.push("/watch/dramaboxv2/" + encodeURIComponent(id))} className="rounded-xl bg-purple-600 px-7 py-3 font-bold">▶ Mulai Nonton</button></section></div>}</div></main>;
}
