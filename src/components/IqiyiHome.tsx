"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useQuery,useInfiniteQuery} from "@tanstack/react-query";

function arr(v:any):any[]{if(Array.isArray(v))return v;if(!v||typeof v!=="object")return[];for(const k of["data","list","rows","results","items","books","dramas","albums"]){if(Array.isArray(v[k]))return v[k];const n=arr(v[k]);if(n.length)return n}return[]}
function pick(v:any,keys:string[],fallback=""){for(const k of keys){const x=v?.[k];if(typeof x==="string"&&x.trim())return x.trim();if(typeof x==="number")return String(x)}return fallback}
function mapItem(x:any,i:number){const id=pick(x,["id","bookId","dramaId","videoId","albumId"],String(i));const albumId=pick(x,["albumId","album_id","albumID"],"");return{id,albumId,title:pick(x,["title","name","bookName","albumName"],"Untitled"),cover:pick(x,["cover","poster","image","thumbnail","coverUrl","pic","albumPic"],""),description:pick(x,["description","synopsis","introduction","desc","summary","shotDesc"],""),episodes:Number(x?.episodes??x?.episodeCount??x?.totalEpisodes??x?.chapterCount??0)}}

function Section({title,data,loading,onMore,hasMore}:{title:string,data:any[],loading:boolean,onMore?:()=>void,hasMore?:boolean}){
 const items=data.map(mapItem);
 if(!items.length&&!loading)return null;
 return <section>
  <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-white">{title}</h2>{hasMore&&onMore&&<button onClick={onMore} disabled={loading} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-50">{loading?"Memuat...":"Muat lebih banyak"}</button>}</div>
  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
   {items.map((x,i)=><Link key={x.id+"-"+i} href={"/detail/iqiyi/"+encodeURIComponent(x.id)+"?title="+encodeURIComponent(x.title)+"&cover="+encodeURIComponent(x.cover)+(x.albumId?"&albumId="+encodeURIComponent(x.albumId):"")+(x.description?"&description="+encodeURIComponent(x.description):"")+(x.episodes?"&episodes="+x.episodes:"")} className="group min-w-0">
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/5 bg-zinc-900">{x.cover?<img src={x.cover} alt={x.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading={i<6?"eager":"lazy"}/>:<div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">No Image</div>}{x.episodes>0&&<span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold">{x.episodes} EP</span>}</div>
    <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/90">{x.title}</h3></Link>)}
  </div>
 </section>
}

async function get(url:string){const r=await fetch(url,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j?.error||"Request gagal");return j}

export function IqiyiHome(){
 const [catalogReady,setCatalogReady]=useState(false);
 useEffect(()=>{const t=window.setTimeout(()=>setCatalogReady(true),150);return()=>window.clearTimeout(t)},[]);
 const trending=useQuery({queryKey:["iqiyi-trending-id"],queryFn:()=>get("/api/iqiyi?action=home&lang=id"),staleTime:600000,gcTime:1800000});
 const drama=useInfiniteQuery({queryKey:["iqiyi-drama-id"],queryFn:({pageParam})=>get("/api/iqiyi?action=drama&page="+pageParam+"&lang=id"),initialPageParam:1,getNextPageParam:(last,pages)=>arr(last).length?pages.length+1:undefined,staleTime:600000,enabled:catalogReady});
 const anime=useInfiniteQuery({queryKey:["iqiyi-anime-id"],queryFn:({pageParam})=>get("/api/iqiyi?action=anime&page="+pageParam+"&lang=id"),initialPageParam:1,getNextPageParam:(last,pages)=>arr(last).length?pages.length+1:undefined,staleTime:600000,enabled:catalogReady});

 const trendingItems=arr(trending.data);
 const dramaItems=drama.data?.pages.flatMap(arr)??[];
 const animeItems=anime.data?.pages.flatMap(arr)??[];

 if(trending.isLoading&& !trendingItems.length)return <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{Array.from({length:12}).map((_,i)=><div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-white/5"/>)}</div>;
 if(trending.error&&!trendingItems.length)return <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">Gagal memuat iQIYI. Pastikan HOSHIYOMI_API_KEY sudah diisi dan plan Hoshiyomi mendukung iQIYI.</div>;

 return <div className="space-y-10">
  <Section title="Trending" data={trendingItems} loading={false}/>
  <Section title="Drama" data={dramaItems} loading={drama.isFetchingNextPage} onMore={()=>drama.fetchNextPage()} hasMore={!!drama.hasNextPage}/>
  <Section title="Anime" data={animeItems} loading={anime.isFetchingNextPage} onMore={()=>anime.fetchNextPage()} hasMore={!!anime.hasNextPage}/>
 </div>
}
