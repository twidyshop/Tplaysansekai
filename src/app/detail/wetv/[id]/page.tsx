"use client";

import {useParams,useRouter} from "next/navigation";
import {useQuery} from "@tanstack/react-query";

function unwrap(v:any):any{let d=v?.data??v;for(let i=0;i<10;i++){if(!d||typeof d!=="object"||Array.isArray(d))break;const n=d.detail??d.drama??d.album??d.video??d.item??d.result??d.data;if(!n||n===d||Array.isArray(n))break;d=n;}return d;}
function pick(v:any,keys:string[],fallback=""){for(const k of keys){const x=v?.[k];if(typeof x==="string"&&x.trim())return x.trim();if(typeof x==="number"&&Number.isFinite(x))return String(x);}return fallback;}
function deep(v:any,keys:string[],fallback="",depth=0):string{if(depth>8||v==null)return fallback;const d=pick(v,keys,"");if(d)return d;if(typeof v!=="object")return fallback;for(const k of Object.keys(v)){const f=deep(v[k],keys,"",depth+1);if(f)return f;}return fallback;}

export default function WetvDetailPage(){
 const params=useParams(),router=useRouter(),search=new URLSearchParams(typeof window!=="undefined"?window.location.search:""),id=String(params.id||"");
 const quickTitle=search.get("title")||"WeTV",quickCover=search.get("cover")||"",quickDescription=search.get("description")||"";
 const {data,isLoading,isFetching}=useQuery({
   queryKey:["wetv","detail",id],
   queryFn:async()=>{
     const controller=new AbortController();
     const timer=setTimeout(()=>controller.abort(),10000);
     try{
       const r=await fetch("/api/wetv?action=detail&id="+encodeURIComponent(id)+"&lang=id",{signal:controller.signal});
       const j=await r.json();
       if(!r.ok)throw new Error(j?.error||"Gagal memuat detail WeTV");
       return j;
     } finally {clearTimeout(timer);}
   },
   enabled:!!id&&!quickDescription,staleTime:1800000,gcTime:3600000,retry:0,refetchOnWindowFocus:false,
 });
 const title=deep(data,["title","name","bookName","albumName","displayName","videoName"],quickTitle);
 const cover=deep(data,["cover","poster","image","thumbnail","coverUrl","pic","albumPic","posterUrl"],quickCover);
 const description=deep(data,["description","synopsis","introduction","intro","desc","summary","plot","content"],quickDescription);
 return <main className="min-h-screen bg-[#0a0e27] text-white">
  <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e27]/90 backdrop-blur-xl"><div className="container mx-auto flex h-14 items-center px-4"><button onClick={()=>router.back()} className="text-sm text-white/70">‹&nbsp; Kembali</button></div></header>
  <div className="container mx-auto max-w-5xl px-4 py-8">
   <div className="grid grid-cols-1 gap-7 md:grid-cols-[280px_1fr]">
    <div className="mx-auto w-full max-w-[280px]"><div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">{cover?<img src={"/api/wetv/image?url="+encodeURIComponent(cover)} alt={title} className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="eager"/>:<div className="flex h-full items-center justify-center text-white/30">No Image</div>}</div></div>
    <section>
     <span className="mb-3 inline-flex rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-300">WeTV</span>
     <h1 className="mb-4 text-3xl font-bold leading-tight md:text-4xl">{title}</h1>
     {description?<div className="mb-6"><h2 className="mb-2 text-sm font-semibold">Sinopsis</h2><p className="whitespace-pre-line text-sm leading-7 text-white/55 md:text-base">{description}</p></div>:isLoading?<p className="mb-5 text-xs text-white/35">Memuat sinopsis...</p>:<p className="mb-5 text-xs text-white/35">Sinopsis belum tersedia.</p>}
     {isFetching&&quickDescription&&<p className="mb-4 text-xs text-white/30">Memperbarui detail WeTV…</p>}
     <button onClick={()=>router.push("/watch/wetv/"+encodeURIComponent(id))} className="w-full rounded-xl bg-teal-400 px-7 py-3.5 font-bold text-black md:w-auto md:min-w-[220px]">▶&nbsp; Mulai Nonton</button>
    </section>
   </div>
  </div>
 </main>;
}
