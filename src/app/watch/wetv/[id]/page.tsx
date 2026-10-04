"use client";

import {useEffect,useMemo,useRef,useState,useCallback} from "react";
import {useParams,useRouter} from "next/navigation";
import Link from "next/link";
import {useWetvDetail,useWetvEpisodes,useWetvPlay} from "@/hooks/useWetv";

function arr(v:any):any[]{if(Array.isArray(v))return v;if(!v||typeof v!=="object")return [];for(const k of ["data","episodes","episodeList","episode_list","episodeData","episode_data","list","rows","results","items","chapters","videos","result"]){if(Array.isArray(v[k]))return v[k];const n=arr(v[k]);if(n.length)return n;}return [];}
function pick(v:any,keys:string[],fallback=""){for(const k of keys){const x=v?.[k];if(typeof x==="string"&&x.trim())return x.trim();if(typeof x==="number"&&Number.isFinite(x))return String(x);}return fallback;}
function deep(v:any,keys:string[],fallback="",depth=0):string{if(depth>8||v==null)return fallback;const d=pick(v,keys,"");if(d)return d;if(typeof v!=="object")return fallback;for(const k of Object.keys(v)){const f=deep(v[k],keys,"",depth+1);if(f)return f;}return fallback;}
function findStream(v:any,depth=0):string{if(!v||depth>10||typeof v!=="object")return "";const direct=pick(v,["hlsUrl","hls","m3u8","streamUrl","stream_url","playUrl","play_url","videoUrl","video_url","url"]);if(/^https?:\/\//i.test(direct)||direct.startsWith("#EXTM3U")||direct.includes("#EXT-X-"))return direct;if(Array.isArray(v)){for(const x of v){const f=findStream(x,depth+1);if(f)return f;}return "";}for(const k of Object.keys(v)){const f=findStream(v[k],depth+1);if(f)return f;}return "";}

export default function WetvWatchPage(){
 const {id}=useParams(),router=useRouter(),dramaId=String(id||"");
 const [selected,setSelected]=useState(1),[source,setSource]=useState(""),[error,setError]=useState(""),[playing,setPlaying]=useState(false);
 const video=useRef<HTMLVideoElement|null>(null),player=useRef<any>(null);
 const detail=useWetvDetail(dramaId),episodesQ=useWetvEpisodes(dramaId),playQ=useWetvPlay(dramaId,selected);
 const episodes=useMemo(()=>arr(episodesQ.data).map((x:any,i:number)=>({id:pick(x,["id","episodeId","episode_id","videoId","video_id"],String(i+1)),number:Number(pick(x,["episode","episodeNumber","episode_no","episodeNo","ep","number","seq","index"],String(i+1)))||i+1,title:pick(x,["title","name","episodeTitle"],"Episode "+(i+1))})).filter((x:any)=>x.number>0).sort((a:any,b:any)=>a.number-b.number),[episodesQ.data]);
 const title=deep(detail.data,["title","name","bookName","albumName","displayName","videoName"],"WeTV");
 useEffect(()=>{const s=findStream(playQ.data);if(s){setSource(s);setError("");}else if(playQ.isError)setError(playQ.error instanceof Error?playQ.error.message:"Gagal memutar WeTV");},[playQ.data,playQ.isError,playQ.error]);
 useEffect(()=>{if(episodes.length&&selected===1&&!episodes.some((x:any)=>x.number===1))setSelected(episodes[0].number);},[episodes,selected]);
 useEffect(()=>{
  let cancelled=false;
  const load=async()=>{
   if((window as any).videojs)return;
   const loadScript=(src:string)=>new Promise<void>((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.async=true;s.dataset.tplayVideojs="1";const t=window.setTimeout(()=>{s.remove();reject(new Error("timeout"));},10000);s.onload=()=>{window.clearTimeout(t);(window as any).videojs?resolve():reject(new Error("Video.js engine tidak ditemukan."));};s.onerror=()=>{window.clearTimeout(t);s.remove();reject(new Error("CDN gagal"));};document.head.appendChild(s);});
   if(!document.querySelector('link[data-tplay-videojs]')){const l=document.createElement("link");l.rel="stylesheet";l.href="https://cdn.jsdelivr.net/npm/video.js@8.24.1/dist/video-js.min.css";l.dataset.tplayVideojs="1";document.head.appendChild(l);}
   try{await loadScript("https://cdn.jsdelivr.net/npm/video.js@8.24.1/dist/video.min.js");}catch{await loadScript("https://unpkg.com/video.js@8.24.1/dist/video.min.js");}
   if(!(window as any).videojs)throw new Error("Video.js gagal dimuat.");
  };
  void load().then(()=>{
   if(cancelled||!video.current||!source)return;
   const videojs=(window as any).videojs;player.current?.dispose?.();player.current=null;
   const isDirect=/^https?:\/\//i.test(source),inline=!isDirect&&(source.startsWith("#EXTM3U")||source.includes("#EXT-X-"));
   const playback=inline?"/api/wetv/stream?id="+encodeURIComponent(dramaId)+"&episode="+encodeURIComponent(String(selected)):"/api/wetv/proxy?url="+encodeURIComponent(source);
   const type=source.includes("#EXTM3U")||source.includes("#EXT-X-")||/\.m3u8(?:[?#]|$)/i.test(source)?"application/x-mpegURL":/\.mp4(?:[?#]|$)/i.test(source)?"video/mp4":"application/x-mpegURL";
   const instance=videojs(video.current,{controls:true,responsive:true,fluid:true,preload:"auto",playsinline:true,playbackRates:[0.5,0.75,1,1.25,1.5,2],html5:{vhs:{overrideNative:true,withCredentials:false,enableLowInitialPlaylist:false},nativeAudioTracks:false,nativeVideoTracks:false},controlBar:{pictureInPictureToggle:true,fullscreenToggle:true,remainingTimeDisplay:true,playbackRateMenuButton:true,subsCapsButton:true,skipButtons:{backward:10,forward:10}}});
   player.current=instance;
   void fetch("/api/wetv/subtitle?id="+encodeURIComponent(dramaId)+"&episode="+encodeURIComponent(String(selected))).then(r=>r.ok?r.json():{tracks:[]}).then(payload=>{if(cancelled||!player.current)return;const tracks=Array.isArray(payload?.tracks)?payload.tracks:[];const hasId=tracks.some((x:any)=>String(x?.language||"").toLowerCase()==="id");tracks.forEach((track:any,index:number)=>{if(!track?.src)return;try{instance.addRemoteTextTrack({kind:"subtitles",src:track.src,srclang:track.language||"und",language:track.language||"und",label:track.label||"Subtitle",default:hasId?String(track.language||"").toLowerCase()==="id":index===0},false);}catch{}});}).catch(()=>{});
   instance.src({src:playback,type});
   instance.on("playing",()=>{setPlaying(true);setError("");});instance.on("waiting",()=>setPlaying(false));
   let recovery=0;instance.on("error",()=>{if(recovery<3){recovery++;window.setTimeout(()=>{if(cancelled||!player.current)return;try{const pos=instance.currentTime();instance.reset();instance.src({src:playback,type});instance.one("loadedmetadata",()=>{if(pos>0)try{instance.currentTime(pos)}catch{}});void instance.play().catch(()=>{});}catch{}},800*recovery);return;}setPlaying(false);setError(instance.error()?.message||"Video WeTV gagal dimuat.");});
   instance.ready(()=>{if(!cancelled)void instance.play().catch(()=>{});});
  }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Gagal memuat Video.js");});
  return()=>{cancelled=true;player.current?.dispose?.();player.current=null;};
 },[source,selected,dramaId]);
 const next=episodes[episodes.findIndex(x=>x.number===selected)+1];
 const play=useCallback((n:number)=>{setSelected(n);setSource("");setError("");setPlaying(false);},[]);
 return <main className="min-h-screen bg-[#0a0e27] text-white"><header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e27]/90 backdrop-blur-xl"><div className="container mx-auto flex h-14 items-center justify-between px-4"><button onClick={()=>router.back()} className="text-sm text-white/70">‹&nbsp; Kembali</button><Link href={"/detail/wetv/"+encodeURIComponent(dramaId)} className="text-sm text-white/70">Detail</Link></div></header><div className="container mx-auto max-w-6xl px-4 py-5"><div className="overflow-hidden rounded-2xl border border-white/10 bg-black" style={{height:"50vh",minHeight:"300px"}}><video ref={video} className="video-js vjs-big-play-centered !h-full !w-full" playsInline preload="auto"/></div><h1 className="mt-5 text-xl font-bold">{title}</h1><p className="mt-1 text-sm text-white/45">Episode {selected}{playing?" • Playing":""}</p>{playQ.isLoading&&<div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">Menyiapkan video WeTV...</div>}{error&&<div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error}</div>}<section className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Episode</h2>{next&&<button onClick={()=>play(next.number)} className="rounded-lg bg-teal-400 px-3 py-2 text-xs font-bold text-black">Episode berikutnya</button>}</div>{episodesQ.isLoading?<p className="text-sm text-white/45">Memuat episode...</p>:episodesQ.error?<p className="text-sm text-red-300">{episodesQ.error instanceof Error?episodesQ.error.message:"Gagal memuat episode WeTV"}</p>:episodes.length?<div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">{episodes.map((x:any)=><button key={x.id+"-"+x.number} onClick={()=>play(x.number)} className={"rounded-lg border px-3 py-2 text-sm font-semibold "+(x.number===selected?"border-teal-300 bg-teal-400 text-black":"border-white/10 bg-white/5 text-white/75")}>{x.number}</button>)}</div>:<p className="text-sm text-white/45">Daftar episode belum tersedia dari API WeTV.</p>}</section></div></main>;
}
