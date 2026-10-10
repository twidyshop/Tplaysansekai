"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { getDramaBoxV2Play, useDramaBoxV2Detail, useDramaBoxV2Episodes, extractDramaBoxV2Items, extractDramaBoxV2Text } from "@/hooks/useDramaBoxV2";
import { useWatchHistoryStore } from "@/hooks/useWatchHistory";

export default function DramaBoxV2WatchPage() {
  const params = useParams();
  const id = String(params.id || "");
  const detailQuery = useDramaBoxV2Detail(id);
  const episodesQuery = useDramaBoxV2Episodes(id);
  const episodes = useMemo(() => extractDramaBoxV2Items(episodesQuery.data), [episodesQuery.data]);
  const [episode, setEpisode] = useState(1);
  const [stream, setStream] = useState("");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const addHistory = useWatchHistoryStore(s => s.addItem);
  const title = extractDramaBoxV2Text(detailQuery.data, ["bookName", "title", "name", "dramaName"], "DramaBox V2");
  const cover = extractDramaBoxV2Text(detailQuery.data, ["cover", "coverUrl", "coverWap", "poster", "image"], "");
  useEffect(() => {
    let cancelled = false;
    setStream(""); setError("");
    getDramaBoxV2Play(id, episode).then(data => {
      const url = extractDramaBoxV2Text(data, ["videoUrl", "video_url", "playUrl", "play_url", "mp4", "url", "hlsUrl", "hls_url", "m3u8"], "");
      if (!url) throw new Error("URL video DramaBox V2 tidak ditemukan dari endpoint episode.");
      if (!cancelled) setStream(url);
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat video."); });
    return () => { cancelled = true; };
  }, [id, episode]);
  useEffect(() => {
    if (!id || !title) return;
    addHistory({ id, title, image: cover, platform: "DramaBox V2", timestamp: Date.now(), url: "/watch/dramaboxv2/" + encodeURIComponent(id), episode, totalEpisodes: episodes.length });
  }, [id, title, cover, episode, episodes.length, addHistory]);
  const episodeNumber = (item: any, index: number) => Number(item?.episode ?? item?.episodeNumber ?? item?.ep ?? item?.index ?? index + 1) || index + 1;
  return <main className="fixed inset-0 flex flex-col bg-black text-white"><header className="absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-gradient-to-b from-black/90 to-transparent px-4"><Link href={"/detail/dramaboxv2/" + encodeURIComponent(id)} className="flex items-center gap-2"><ChevronLeft/>Kembali</Link><button onClick={() => setMenu(v => !v)} aria-label="Daftar episode">{menu ? <X/> : <Menu/>}</button></header><div className="flex min-h-0 flex-1 items-center justify-center pt-14">{episodesQuery.isLoading || detailQuery.isLoading ? <p>Memuat DramaBox V2...</p> : error ? <p className="px-6 text-center text-red-300">{error}</p> : stream ? <video key={stream} className="max-h-full w-full bg-black object-contain" src={stream} controls autoPlay playsInline onEnded={() => setEpisode(v => v + 1)} /> : <p>Menyiapkan video...</p>}</div><footer className="flex items-center justify-between gap-4 bg-black/90 px-4 py-3"><button disabled={episode <= 1} onClick={() => setEpisode(v => Math.max(1, v - 1))} className="flex items-center gap-1 disabled:opacity-30"><ChevronLeft/> Sebelumnya</button><span>Episode {episode}{episodes.length ? " / " + episodes.length : ""}</span><button disabled={episodes.length > 0 && episode >= episodes.length} onClick={() => setEpisode(v => v + 1)} className="flex items-center gap-1 disabled:opacity-30">Berikutnya <ChevronRight/></button></footer>{menu && <div className="absolute inset-y-14 right-0 z-40 w-72 max-w-[85vw] overflow-y-auto border-l border-white/10 bg-[#101010] p-4"><h2 className="mb-3 font-bold">Daftar Episode</h2><div className="grid grid-cols-4 gap-2">{Array.from({length: Math.max(episodes.length, 1)}, (_,i) => i+1).map(n => <button key={n} onClick={() => {setEpisode(n);setMenu(false)}} className={"rounded-lg p-2 text-sm " + (episode === n ? "bg-purple-600" : "bg-white/10")}>{n}</button>)}</div></div>}</main>;
}
