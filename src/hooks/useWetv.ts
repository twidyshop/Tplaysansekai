"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetcher";

function qs(id:string,episode?:number){return new URLSearchParams({id,lang:"id",...(episode?{episode:String(episode)}:{})});}
export function useWetvDetail(id:string){return useQuery({queryKey:["wetv","detail",id],queryFn:()=>fetchJson<any>("/api/wetv?action=detail&"+qs(id).toString()),enabled:!!id,staleTime:600000});}
export function useWetvEpisodes(id:string){return useQuery({queryKey:["wetv","episodes",id],queryFn:()=>fetchJson<any>("/api/wetv?action=episodes&"+qs(id).toString()),enabled:!!id,staleTime:600000,retry:0});}
export function useWetvPlay(id:string,episode:number){const p=qs(id,episode);return useQuery({queryKey:["wetv","play",id,episode],queryFn:()=>fetchJson<any>("/api/wetv?action=play&"+p.toString()),enabled:!!id&&episode>0,staleTime:60000,retry:0});}
