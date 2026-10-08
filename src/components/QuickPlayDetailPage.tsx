"use client";
import {useParams,useRouter} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {getQuickPlayDetail,type QuickPlayPlatform} from "@/hooks/useQuickPlay";
function pick(v:any,keys:string[]){for(const k of keys){if(typeof v?.[k]==="string"&&v[k].trim())return v[k].trim();}return "";}
function unwrap(v:any){let x=v?.data??v;for(let i=0;i<4&&x&&typeof x==="object";i++){if(x.detail)x=x.detail;else if(x.drama)x=x.drama;else if(x.book)x=x.book;else if(x.data&&typeof x.data==="object")x=x.data;else break;}return x;}
export default function QuickPlayDetailPage({platform,name}:{platform:QuickPlayPlatform;name:string}){
 const p=useParams();const router=useRouter();const id=String(p.id||"");
 const q=useQuery({queryKey:["quickplay-detail",platform,id],enabled:!!id,queryFn:()=>getQuickPlayDetail(platform,id),retry:2});
 if(q.isLoading)return <main className="min-h-screen bg-black text-white flex items-center justify-center">Memuat detail...</main>;
 if(q.error||!q.data)return <main className="min-h-screen bg-black text-white flex items-center justify-center">Drama tidak ditemukan</main>;
 const d=unwrap(q.data);const title=pick(d,["title","bookName","book_name","dramaName","name"])||"Untitled";const cover=pick(d,["cover","coverUrl","cover_url","poster","posterUrl","image","thumbnail","book_pic"]);const intro=pick(d,["synopsis","introduction","description","desc","summary"]);const episodes=Array.isArray(d?.episodes)?d.episodes:Array.isArray(d?.chapters)?d.chapters:Array.isArray(d?.episodeList)?d.episodeList:[];
 return <main className="min-h-screen bg-black text-white"><header className="sticky top-0 z-10 h-14 border-b border-white/10 flex items-center px-4"><button onClick={()=>router.back()}>‹ Kembali</button></header><div className="max-w-5xl mx-auto p-5 grid md:grid-cols-[240px_1fr] gap-7"><div className="aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden">{cover&&<img src={cover} alt={title} className="w-full h-full object-cover" referrerPolicy="no-referrer"/>}</div><section><div className="text-xs text-purple-300 mb-2">{name}</div><h1 className="text-3xl font-bold mb-4">{title}</h1>{intro&&<p className="text-zinc-400 leading-7 mb-5 whitespace-pre-line">{intro}</p>}<p className="text-zinc-500 mb-5">{episodes.length||Number(d?.episodeCount||d?.chapterCount)||0} episode</p><button onClick={()=>router.push("/watch/"+platform+"/"+encodeURIComponent(id))} className="px-6 py-3 rounded-xl bg-purple-600 font-bold">▶ Mulai Nonton</button></section></div></main>;
}