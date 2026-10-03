"use client";

import Link from "next/link";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";

function arr(v:any):any[]{if(Array.isArray(v))return v;if(!v||typeof v!=="object")return[];for(const k of["data","list","rows","results","items","books","dramas","albums"]){if(Array.isArray(v[k]))return v[k];const n=arr(v[k]);if(n.length)return n}return[]}
function pick(v:any,keys:string[],fallback=""){for(const k of keys){const x=v?.[k];if(typeof x==="string"&&x.trim())return x.trim();if(typeof x==="number")return String(x)}return fallback}
function mapItem(x:any,i:number){return{id:pick(x,["id","bookId","albumId","dramaId","videoId"],String(i)),title:pick(x,["title","name","bookName","albumName"],"Untitled"),cover:pick(x,["cover","poster","image","thumbnail","coverUrl","pic","albumPic"],""),episodes:Number(x?.episodes??x?.episodeCount??x?.totalEpisodes??x?.chapterCount??0)}}

function Section({title,data,more,setMore}:{title:string,data:any,more:boolean,setMore:()=>void}){
 const items=arr(data).map(mapItem).slice(0,more?36:18);
 if(!items.length)return null;
 return <section>
  <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-white">{title}</h2>{!more&&<button onClick={setMore} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10">Muat lebih banyak</button>}</div>
  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
   {items.map((x,i)=><Link key={x.id+"-"+i} href={"/detail/iqiyi/"+encodeURIComponent(x.id)+"?title="+encodeURIComponent(x.title)+"&cover="+encodeURIComponent(x.cover)} className="group min-w-0">
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/5 bg-zinc-900">{x.cover?<img src={x.cover} alt={x.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading={i<6?"eager":"lazy"}/>:<div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">No Image</div>}{x.episodes>0&&<span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold">{x.episodes} EP</span>}</div>
    <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/90">{x.title}</h3></Link>)}
  </div>
 </section>
}

async function get(url:string){const r=await fetch(url,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j?.error||"Request gagal");return j}

export function IqiyiHome(){
 const [trendingMore,setTrendingMore]=useState(false),[dramaMore,setDramaMore]=useState(false),[animeMore,setAnimeMore]=useState(false);
 const trending=useQuery({queryKey:["iqiyi-trending"],queryFn:()=>get("/api/iqiyi?action=home&lang=id"),staleTime:300000});
 const drama=useQuery({queryKey:["iqiyi-drama"],queryFn:()=>get("/api/iqiyi?action=drama&page=1&lang=id"),staleTime:300000});
 const anime=useQuery({queryKey:["iqiyi-anime"],queryFn:()=>get("/api/iqiyi?action=anime&page=1&lang=id"),staleTime:300000});
 if(trending.isLoading&&drama.isLoading&&anime.isLoading)return <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{Array.from({length:12}).map((_,i)=><div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-white/5"/>)}</div>;
 if(trending.error&&drama.error&&anime.error)return <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">Gagal memuat iQIYI. Pastikan HOSHIYOMI_API_KEY sudah diisi dan plan Hoshiyomi mendukung iQIYI.</div>;
 return <div className="space-y-10">
  <Section title="Trending" data={trending.data} more={trendingMore} setMore={()=>setTrendingMore(true)}/>
  <Section title="Drama" data={drama.data} more={dramaMore} setMore={()=>setDramaMore(true)}/>
  <Section title="Anime" data={anime.data} more={animeMore} setMore={()=>setAnimeMore(true)}/>
 </div>
}
