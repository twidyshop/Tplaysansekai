"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import Hls from "hls.js";

function arr(v:any):any[]{
  if(Array.isArray(v)) return v;
  if(!v||typeof v!=="object") return [];
  for(const k of ["data","episodes","list","rows","results","items","chapters"]){
    if(Array.isArray(v[k])) return v[k];
    const n=arr(v[k]); if(n.length) return n;
  }
  return [];
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
  const [episodes,setEpisodes]=useState<any[]>([]),[title,setTitle]=useState("iQIYI"),[selected,setSelected]=useState(1),[source,setSource]=useState(""),[loading,setLoading]=useState(true),[playing,setPlaying]=useState(false),[error,setError]=useState("");

  const play=useCallback(async(n:number)=>{
    setSelected(n);setPlaying(false);setError("");setSource("");
    try{
      const r=await fetch("/api/iqiyi?action=play&id="+encodeURIComponent(dramaId)+(albumId?"&albumId="+encodeURIComponent(albumId):"")+"&episode="+n+"&lang=id");
      const j=await r.json();
      if(!r.ok) throw new Error(j?.error||"Gagal mengambil video");
      const stream=findStream(j);
      if(!stream) throw new Error("Hoshiyomi tidak mengembalikan URL video yang bisa diputar.");
      setSource(stream);
    }catch(e){setError(e instanceof Error?e.message:"Gagal memutar video")}
  },[dramaId,albumId]);

  const load=useCallback(async()=>{
    if(!dramaId) return;
    setLoading(true);setError("");

    // Start the first episode request immediately; do not wait for metadata.
    void play(1);

    // Metadata is deliberately background-only so a slow detail endpoint cannot block playback.
    void fetch("/api/iqiyi?action=detail&id="+encodeURIComponent(dramaId)+(albumId?"&albumId="+encodeURIComponent(albumId):"")+"&lang=id")
      .then(r=>r.ok?r.json():null)
      .then(j=>{
        if(j){
          const d=j?.data?.detail??j?.data?.drama??j?.data?.album??j?.data??j;
          setTitle(pick(d,["title","name","bookName","albumName","displayName","albumTitle","videoName"],"iQIYI"));
        }
      }).catch(()=>{});

    try{
      const a=await fetch("/api/iqiyi?action=episodes&id="+encodeURIComponent(dramaId)+(albumId?"&albumId="+encodeURIComponent(albumId):"")+"&lang=id");
      const aj=await a.json();
      if(!a.ok) throw new Error(aj?.error||"Gagal memuat episode");
      const list=arr(aj).map((x:any,i:number)=>({
        id:pick(x,["id","episodeId","episode_id"],String(i+1)),
        number:Number(x?.episode??x?.episodeNumber??x?.episode_index??i+1)||i+1,
        title:pick(x,["title","name","episodeTitle"],"Episode "+(i+1))
      }));
      setEpisodes(list);
      if(list.length&&list[0].number!==1) setSelected(list[0].number);
    }catch(e){setError(e instanceof Error?e.message:"Gagal memuat episode")}
    finally{setLoading(false)}
  },[dramaId,play]);

  useEffect(()=>{void load()},[load]);

  useEffect(()=>{
    if(!source||!video.current) return;
    const v=video.current;
    hls.current?.destroy();
    let instance:Hls|null=null,blob="";
    let url=source;
    const isDirect=/^https?:\/\//i.test(source);

    let recoveredMedia=false;
    let recoveredNetwork=false;
    const fail=()=>setError("Video iQIYI gagal dimuat. Player sudah mencoba pemulihan otomatis; coba episode lagi jika CDN sedang bermasalah.");

    const start=async()=>{
      try{
        if(!isDirect){
          if(source.startsWith("#EXTM3U")||source.includes("#EXT-X-")){
            blob=URL.createObjectURL(new Blob([source],{type:"application/vnd.apple.mpegurl"}));
            v.src=blob;await v.play().catch(()=>{});setPlaying(true);
          }else setError("Format video iQIYI tidak dikenali.");
          return;
        }
        if(v.canPlayType("application/vnd.apple.mpegurl")){
          v.src=url;
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
          instance.loadSource(url);instance.attachMedia(v);
          instance.on(Hls.Events.MANIFEST_PARSED,()=>{setPlaying(true);void v.play().catch(()=>{})});
          instance.on(Hls.Events.ERROR,(_,d)=>{
            if(!d.fatal) return;
            if(d.type===Hls.ErrorTypes.NETWORK_ERROR&&!recoveredNetwork){
              recoveredNetwork=true;
              instance?.startLoad();
              return;
            }
            if(d.type===Hls.ErrorTypes.MEDIA_ERROR&&!recoveredMedia){
              recoveredMedia=true;
              instance?.recoverMediaError();
              return;
            }
            fail();
          });
        }else setError("Browser tidak mendukung HLS.");
      }catch(e){setError(e instanceof Error?e.message:"Gagal menyiapkan player")}
    };

    void start();
    return()=>{instance?.destroy();hls.current=null;v.removeAttribute("src");v.load();if(blob)URL.revokeObjectURL(blob)};
  },[source]);

  const next=episodes[episodes.findIndex(x=>x.number===selected)+1];

  return <main className="min-h-screen bg-[#0a0e27] text-white">
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e27]/90 backdrop-blur-xl"><div className="container mx-auto flex h-14 items-center justify-between px-4"><button onClick={()=>router.back()} className="text-sm text-white/70">‹&nbsp; Kembali</button><Link href={"/detail/iqiyi/"+encodeURIComponent(dramaId)} className="text-sm text-white/70">Detail</Link></div></header>
    <div className="container mx-auto max-w-6xl px-4 py-5">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black"><video ref={video} controls playsInline preload="metadata" className="aspect-video w-full bg-black"/></div>
      <h1 className="mt-5 text-xl font-bold">{title}</h1><p className="mt-1 text-sm text-white/45">Episode {selected}</p>
      {error&&<div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error}</div>}
      {loading?<p className="mt-6 text-sm text-white/45">Memuat episode...</p>:<section className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Episode</h2>{next&&<button onClick={()=>void play(next.number)} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black">Episode berikutnya</button>}</div><div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">{episodes.map(x=><button key={x.id+"-"+x.number} onClick={()=>void play(x.number)} className={"rounded-lg border px-3 py-2 text-sm font-semibold "+(x.number===selected?"border-emerald-400 bg-emerald-500 text-black":"border-white/10 bg-white/5 text-white/75")}>{x.number}</button>)}</div></section>}
    </div>
  </main>;
}
