"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetcher";

function qs(id:string,episode?:number,page=1,limit=100){
  return new URLSearchParams({id,lang:"id",page:String(page),limit:String(limit),...(episode?{episode:String(episode)}:{})});
}
export function useWetvSearch(query:string,type?:string){
  const q=query.trim();
  return useQuery({
    queryKey:["wetv","search",q,type||""],
    queryFn:async()=>{const r=await fetch("/api/wetv?action=search&q="+encodeURIComponent(q)+"&lang=id"+(type?"&type="+encodeURIComponent(type):""));const j=await r.json();if(!r.ok)throw new Error(j?.error||"Gagal mencari WeTV");return Array.isArray(j)?j:(j?.data||j?.results||j?.items||j);},
    enabled:q.length>0,staleTime:120000
  });
}
export function useWetvDetail(id:string){
  return useQuery({queryKey:["wetv","detail",id],queryFn:()=>fetchJson<any>("/api/wetv?action=detail&"+new URLSearchParams({id,lang:"id"}).toString()),enabled:!!id,staleTime:1800000,gcTime:3600000,retry:1});
}
export function useWetvEpisodes(id:string){
  return useQuery({queryKey:["wetv","episodes",id],queryFn:()=>fetchJson<any>("/api/wetv?action=episodes&"+qs(id,undefined,1,100).toString()),enabled:!!id,staleTime:600000,gcTime:1800000,retry:1});
}
export function useWetvPlay(id:string,episode:number){
  return useQuery({queryKey:["wetv","play",id,episode],queryFn:()=>fetchJson<any>("/api/wetv?action=play&"+new URLSearchParams({id,ep:String(episode),lang:"id"}).toString()),enabled:!!id&&episode>0,staleTime:60000,retry:0});
}
