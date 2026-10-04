"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

function arr(v:any):any[] {
  if(Array.isArray(v)) return v;
  if(!v||typeof v!=="object") return [];
  for(const k of ["data","list","rows","results","items","books","dramas","albums","records","contents","videos","programs"]) {
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
function Cards({items}:{items:any[]}) {
  return <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
    {items.map((x,i)=><Link key={x.id+"-"+i} href={"/detail/wetv/"+encodeURIComponent(x.id)+"?title="+encodeURIComponent(x.title)+"&cover="+encodeURIComponent(x.cover)+(x.description?"&description="+encodeURIComponent(x.description):"")} className="group min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/5 bg-zinc-900">
        {x.cover?<img src={"/api/wetv/image?url="+encodeURIComponent(x.cover)} alt={x.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>:<div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">No Image</div>}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/90">{x.title}</h3>
    </Link>)}
  </div>;
}
function Section({title,items,loading=false}:{title:string,items:any[],loading?:boolean}) {
  if(loading) return <section className="space-y-4"><div className="h-6 w-32 animate-pulse rounded bg-white/5"/><div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{Array.from({length:12}).map((_,i)=><div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-white/5"/>)}</div></section>;
  if(!items.length) return null;
  return <section className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-white">{title}</h2><span className="text-xs text-white/35">WeTV</span></div>
    <Cards items={items}/>
  </section>;
}
export function WetvHome() {
  const [more,setMore]=useState(false),[animeMore,setAnimeMore]=useState(false);
  const trending=useQuery({queryKey:["wetv","home",more?2:1],queryFn:async()=>{const r=await fetch("/api/wetv?action=home&lang=id&page="+(more?2:1)+"&limit=30");const j=await r.json();if(!r.ok)throw new Error(j?.error||"Gagal memuat WeTV");return arr(j);},staleTime:600000,gcTime:1800000});
  const anime=useQuery({queryKey:["wetv","anime",1],queryFn:async()=>{const r=await fetch("/api/wetv?action=anime&lang=id&page=1");const j=await r.json();if(!r.ok)throw new Error(j?.error||"Gagal memuat WeTV Anime");return arr(j);},staleTime:600000,gcTime:1800000});
  const animeMoreQ=useQuery({queryKey:["wetv","anime",2],queryFn:async()=>{const r=await fetch("/api/wetv?action=anime&lang=id&page=2");const j=await r.json();if(!r.ok)throw new Error(j?.error||"Gagal memuat WeTV Anime");return arr(j);},enabled:animeMore,staleTime:600000,gcTime:1800000});
  const trendingItems=trending.data?.map(mapItem).slice(0,30)||[];
  const animeItems=[...(anime.data||[]),...(animeMore?(animeMoreQ.data||[]):[])].map(mapItem).slice(0,60);
  if(trending.error&&!trendingItems.length) return <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">Gagal memuat WeTV: {trending.error instanceof Error?trending.error.message:"Request gagal"}</div>;
  return <div className="space-y-10">
    <Section title="Trending" items={trendingItems} loading={trending.isLoading&&!trendingItems.length}/>
    <div className="flex justify-center">
      <button onClick={()=>setMore(v=>!v)} className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10">{more?"Tampilkan Trending Awal":"Lihat lebih banyak Trending"}</button>
    </div>
    <Section title="Anime" items={animeItems} loading={anime.isLoading&&!animeItems.length}/>
    <div className="flex justify-center -mt-5"><button onClick={()=>setAnimeMore(v=>!v)} disabled={animeMore&&animeMoreQ.isLoading} className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50">{animeMore?(animeMoreQ.isLoading?"Memuat…":"Tampilkan Anime Awal"):"Lihat lebih banyak Anime"}</button></div>
  </div>;
}
