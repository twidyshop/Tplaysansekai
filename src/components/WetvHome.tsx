"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

function arr(v:any):any[] {
  if(Array.isArray(v)) return v;
  if(!v||typeof v!=="object") return [];
  for(const k of ["data","list","rows","results","items","books","dramas","albums"]) {
    if(Array.isArray(v[k])) return v[k];
    const n=arr(v[k]); if(n.length) return n;
  }
  return [];
}
function pick(v:any,keys:string[],fallback="") {
  for(const k of keys){const x=v?.[k];if(typeof x==="string"&&x.trim())return x.trim();if(typeof x==="number"&&Number.isFinite(x))return String(x);}
  return fallback;
}
function deepPick(v:any,keys:string[],fallback="",depth=0):string {
  if(depth>8||v==null)return fallback;
  const d=pick(v,keys,""); if(d)return d;
  if(typeof v!=="object")return fallback;
  for(const k of Object.keys(v)){const f=deepPick(v[k],keys,"",depth+1);if(f)return f;}
  return fallback;
}
function mapItem(x:any,i:number) {
  const id=pick(x,["id","bookId","dramaId","videoId","contentId","albumId"],String(i));
  const title=pick(x,["title","name","bookName","albumName","videoName"],"Untitled");
  const cover=pick(x,["cover","poster","image","thumbnail","coverUrl","pic","albumPic","posterUrl"],"");
  return {id,title,cover,description:deepPick(x,["description","synopsis","introduction","intro","desc","summary","plot","content"],"")};
}
export function WetvHome() {
  const q=useQuery({
    queryKey:["wetv","home"],
    queryFn:async()=>{const r=await fetch("/api/wetv?action=home&lang=id");const j=await r.json();if(!r.ok)throw new Error(j?.error||"Gagal memuat WeTV");return arr(j);},
    staleTime:600000,gcTime:1800000,
  });
  const items=(q.data||[]).slice(0,30).map(mapItem);
  if(q.isLoading&&!items.length) return <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{Array.from({length:12}).map((_,i)=><div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-white/5"/>)}</div>;
  if(q.error&&!items.length) return <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">Gagal memuat WeTV. Pastikan HOSHIYOMI_API_KEY mendukung WeTV.</div>;
  return <section className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-white">Trending</h2><span className="text-xs text-white/35">WeTV</span></div>
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
      {items.map((x,i)=><Link key={x.id+"-"+i} href={"/detail/wetv/"+encodeURIComponent(x.id)+"?title="+encodeURIComponent(x.title)+"&cover="+encodeURIComponent(x.cover)+(x.description?"&description="+encodeURIComponent(x.description):"")} className="group min-w-0">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/5 bg-zinc-900">
          {x.cover?<img src={"/api/wetv/image?url="+encodeURIComponent(x.cover)} alt={x.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>:<div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">No Image</div>}
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/90">{x.title}</h3>
      </Link>)}
    </div>
  </section>;
}
