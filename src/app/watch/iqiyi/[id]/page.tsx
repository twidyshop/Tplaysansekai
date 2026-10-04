"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import Hls from "hls.js";
import {useIqiyiDetail,useIqiyiEpisodes,useIqiyiPlay} from "@/hooks/useIqiyi";

function arr(v:any):any[]{
  if(Array.isArray(v)) return v;
  if(!v||typeof v!=="object") return [];
  for(const k of ["data","episodes","episodeList","episode_list","episodeData","episode_data","list","rows","results","items","chapters","videos","result"]){
    if(Array.isArray(v[k])) return v[k];
    const n=arr(v[k]); if(n.length) return n;
  }
  return [];
}
function deepText(value:any,keys:string[],fallback="",depth=0):string{
  if(depth>8||value==null) return fallback;
  const direct=pick(value,keys,"");
  if(direct) return direct;
  if(typeof value!=="object") return fallback;
  for(const key of Object.keys(value)){ const found=deepText(value[key],keys,"",depth+1); if(found) return found; }
  return fallback;
}
function pick(v:any,keys:string[],fallback=""){
  for(const k of keys){
    const x=v?.[k];
    if(typeof x==="string"&&x.trim()) return x.trim();
    if(typeof x==="number"&&Number.isFinite(x)) return String(x);
  }
  return fallback;
}
function findStream(v:any):string{
  if(!v||typeof v!=="object") return "";
  const direct=pick(v,["hlsUrl","hls","m3u8","streamUrl","stream_url","playUrl","play_url","videoUrl","video_url","url"],"");
  if(/^https?:\/\//i.test(direct)||direct.startsWith("#EXTM3U")||direct.includes("#EXT-X-")) return direct;
  for(const k of ["data","result","stream","video","play","source"]){
    const found=findStream(v[k]);
    if(found) return found;
  }
  return "";
}

export default function IqiyiWatchPage(){
  const {id}=useParams(),router=useRouter(),search=new URLSearchParams(typeof window!=="undefined"?window.location.search:""),dramaId=String(id||""),albumId=search.get("albumId")||"";
  const video=useRef<HTMLVideoElement|null>(null),hls=useRef<Hls|null>(null);
  const [selected,setSelected]=useState(1),[source,setSource]=useState(""),[error,setError]=useState(""),[playing,setPlaying]=useState(false);
  const detailQuery=useIqiyiDetail(dramaId,albumId);
  const episodesQuery=useIqiyiEpisodes(dramaId,albumId);
  const playQuery=useIqiyiPlay(dramaId,selected,albumId);
  const episodes=arr(episodesQuery.data||{}).map((x:any,i:number)=>({
    id:pick(x,["id","episodeId","episode_id"],String(i+1)),
    number:Number(x?.episode??x?.episodeNumber??x?.episode_index??i+1)||i+1,
    title:pick(x,["title","name","episodeTitle"],"Episode "+(i+1))
  }));
  const title=deepText(
    detailQuery.data?.data?.detail??detailQuery.data?.data?.drama??detailQuery.data?.data?.album??detailQuery.data?.data??detailQuery.data,
    ["title","name","bookName","albumName","displayName","albumTitle","videoName"],
    "iQIYI"
  );

  useEffect(()=>{
    const stream=findStream(playQuery.data);
    if(stream){setSource(stream);setError("");}
    else if(playQuery.isError){
      setSource("");
      setError(playQuery.error instanceof Error?playQuery.error.message:"Gagal memutar video iQIYI");
    }
  },[playQuery.data,playQuery.isError,playQuery.error]);

  useEffect(()=>{
    if(episodes.length&&selected===1&&episodes[0].number!==1) setSelected(episodes[0].number);
  },[episodes,selected]);

  useEffect(()=>{
    if(episodesQuery.isError && !episodes.length) setError("");
  },[episodesQuery.isError,episodes.length]);

  const loading=episodesQuery.isLoading;
  const episodeError=episodesQuery.isError ? (episodesQuery.error instanceof Error?episodesQuery.error.message:"Episode belum berhasil dimuat.") : "";
  const playLoading=playQuery.isLoading||playQuery.isFetching;

  const play=useCallback((n:number)=>{
    setSelected(n);setSource("");setError("");setPlaying(false);
  },[]);

  useEffect(()=>{
    if(!source||!video.current) return;
    const v=video.current;
    hls.current?.destroy();
    let instance:Hls|null=null,blob="";
    let url=source;

    const fail=()=>{setPlaying(false);setError("Video iQIYI gagal dimuat. Player sudah mencoba pemulihan otomatis; coba episode lagi jika CDN sedang bermasalah.");};
    const makeProxyUrl=(target:string)=>"/api/iqiyi/proxy?url="+encodeURIComponent(target);
    const isDirect=/^https?:\/\//i.test(source);
    const isInlineManifest=!isDirect&&(source.startsWith("#EXTM3U")||source.includes("#EXT-X-"));

    // Hoshiyomi may return the HLS manifest itself instead of an .m3u8 URL.
    // Rewrite every media/playlist URL through our same-origin proxy before
    // creating the Blob. Otherwise the browser requests iQIYI .ts segments
    // directly and they can fail because of CDN/CORS/header restrictions.
    const proxyInlineManifest=(manifest:string)=>{
      const baseUrl=window.location.href;
      return manifest.split(/\r?\n/).map(line=>{
        const trimmed=line.trim();
        if(!trimmed) return line;

        const rewrite=(raw:string)=>{
          try{
            const absolute=new URL(raw,baseUrl).toString();
            return makeProxyUrl(absolute);
          }catch{
            return raw;
          }
        };

        if(trimmed.startsWith("#")){
          return line.replace(/URI="([^"]+)"/g,(_,raw)=>`URI="${rewrite(raw)}"`);
        }

        return rewrite(trimmed);
      }).join("\n");
    };

    const start=async()=>{
      try{
        if(isInlineManifest){
          const proxiedManifest=proxyInlineManifest(source);
          blob=URL.createObjectURL(new Blob([proxiedManifest],{type:"application/vnd.apple.mpegurl"}));

          if(v.canPlayType("application/vnd.apple.mpegurl")){
            v.src=blob;
            v.addEventListener("error",fail,{once:true});
            await v.play().catch(()=>{});
            setPlaying(true);
            return;
          }

          if(Hls.isSupported()){
            instance=new Hls({
              enableWorker:true,
              lowLatencyMode:false,
              backBufferLength:90,
              maxBufferLength:30,
              maxBufferSize:60*1000*1000,
              manifestLoadingMaxRetry:2,
              levelLoadingMaxRetry:3,
              fragLoadingMaxRetry:4,
              manifestLoadingRetryDelay:500,
              levelLoadingRetryDelay:500,
              fragLoadingRetryDelay:500,
              enableSoftwareAES:true,
            });
            hls.current=instance;
            instance.loadSource(blob);
            instance.attachMedia(v);
            instance.on(Hls.Events.MANIFEST_PARSED,()=>{setPlaying(true);void v.play().catch(()=>{})});
            instance.on(Hls.Events.ERROR,(_,d)=>{
              if(!d.fatal) return;
              if(d.type===Hls.ErrorTypes.NETWORK_ERROR){
                instance?.startLoad();
                return;
              }
              if(d.type===Hls.ErrorTypes.MEDIA_ERROR){
                instance?.recoverMediaError();
                return;
              }
              fail();
            });
            return;
          }

          setError("Browser tidak mendukung HLS.");
          return;
        }

        if(!isDirect){
          setError("Format video iQIYI tidak dikenali.");
          return;
        }

        const proxiedUrl=makeProxyUrl(url);

        if(v.canPlayType("application/vnd.apple.mpegurl")){
          v.src=proxiedUrl;
          v.addEventListener("error",fail,{once:true});
          await v.play().catch(()=>{});
          setPlaying(true);
          return;
        }

        if(Hls.isSupported()){
          instance=new Hls({
            enableWorker:true,
            lowLatencyMode:false,
            backBufferLength:90,
            maxBufferLength:30,
            maxBufferSize:60*1000*1000,
            manifestLoadingMaxRetry:2,
            levelLoadingMaxRetry:3,
            fragLoadingMaxRetry:4,
            manifestLoadingRetryDelay:500,
            levelLoadingRetryDelay:500,
            fragLoadingRetryDelay:500,
            enableSoftwareAES:true,
          });
          hls.current=instance;
          instance.loadSource(proxiedUrl);instance.attachMedia(v);
          instance.on(Hls.Events.MANIFEST_PARSED,()=>{setPlaying(true);void v.play().catch(()=>{})});
          instance.on(Hls.Events.ERROR,(_,d)=>{
            if(!d.fatal) return;
            if(d.type===Hls.ErrorTypes.NETWORK_ERROR){
              instance?.startLoad();
              return;
            }
            if(d.type===Hls.ErrorTypes.MEDIA_ERROR){
              instance?.recoverMediaError();
              return;
            }
            fail();
          });
        }else setError("Browser tidak mendukung HLS.");
      }catch(e){setPlaying(false);setError(e instanceof Error?e.message:"Gagal menyiapkan player");}
    };

    void start();
    return()=>{instance?.destroy();hls.current=null;v.removeAttribute("src");v.load();if(blob)URL.revokeObjectURL(blob)};
  },[source]);

  const next=episodes[episodes.findIndex(x=>x.number===selected)+1];

  return <main className="min-h-screen bg-[#0a0e27] text-white">
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e27]/90 backdrop-blur-xl"><div className="container mx-auto flex h-14 items-center justify-between px-4"><button onClick={()=>router.back()} className="text-sm text-white/70">‹&nbsp; Kembali</button><Link href={"/detail/iqiyi/"+encodeURIComponent(dramaId)} className="text-sm text-white/70">Detail</Link></div></header>
    <div className="container mx-auto max-w-6xl px-4 py-5">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black"><video ref={video} controls playsInline preload="metadata" className="aspect-video w-full bg-black"/></div>
      <h1 className="mt-5 text-xl font-bold">{title}</h1><p className="mt-1 text-sm text-white/45">Episode {selected}{playing?" • Playing":""}</p>
      {playLoading&&<div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">Menyiapkan video iQIYI...</div>}{error&&<div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error}</div>}{episodeError&&<div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-sm text-yellow-200">Episode belum berhasil dimuat. Player tetap bisa dicoba.</div>}
      {loading?<p className="mt-6 text-sm text-white/45">Memuat episode...</p>:<section className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Episode</h2>{next&&<button onClick={()=>void play(next.number)} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black">Episode berikutnya</button>}</div><div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">{episodes.map(x=><button key={x.id+"-"+x.number} onClick={()=>void play(x.number)} className={"rounded-lg border px-3 py-2 text-sm font-semibold "+(x.number===selected?"border-emerald-400 bg-emerald-500 text-black":"border-white/10 bg-white/5 text-white/75")}>{x.number}</button>)}</div></section>}
    </div>
  </main>;
}