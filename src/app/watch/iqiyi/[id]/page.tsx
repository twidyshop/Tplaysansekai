"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
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
  const video=useRef<HTMLVideoElement|null>(null),player=useRef<any>(null);
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
    let cancelled=false;

    const loadVideoJs=async()=>{
      if((window as any).videojs) return;

      const loadScript=(src:string)=>new Promise<void>((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=src;
        script.async=true;
        script.dataset.tplayVideojs='1';
        const timer=window.setTimeout(()=>{
          script.remove();
          reject(new Error('timeout'));
        },10000);
        script.onload=()=>{
          window.clearTimeout(timer);
          if((window as any).videojs) resolve();
          else reject(new Error('Video.js engine tidak ditemukan.'));
        };
        script.onerror=()=>{
          window.clearTimeout(timer);
          script.remove();
          reject(new Error('CDN gagal'));
        };
        document.head.appendChild(script);
      });

      if(!document.querySelector('link[data-tplay-videojs]')){
        const link=document.createElement('link');
        link.rel='stylesheet';
        link.href='https://cdn.jsdelivr.net/npm/video.js@8.24.1/dist/video-js.min.css';
        link.dataset.tplayVideojs='1';
        document.head.appendChild(link);
      }

      const failed=document.querySelectorAll('script[data-tplay-videojs]');
      failed.forEach(node=>node.remove());

      try{
        await loadScript('https://cdn.jsdelivr.net/npm/video.js@8.24.1/dist/video.min.js');
      }catch{
        await loadScript('https://unpkg.com/video.js@8.24.1/dist/video.min.js');
      }

      if(!(window as any).videojs) throw new Error('Video.js gagal dimuat dari CDN utama maupun cadangan.');
    };

    void loadVideoJs().then(()=>{
      if(cancelled||!video.current||!source) return;
      const videojs=(window as any).videojs;
      if(!videojs) throw new Error('Engine Video.js tidak tersedia.');

      player.current?.dispose?.();
      player.current=null;

      const v=video.current;
      const makeProxyUrl=(target:string)=>'/api/iqiyi/proxy?url='+encodeURIComponent(target);
      const isDirect=/^https?:\/\//i.test(source);
      const isInlineManifest=!isDirect&&(source.startsWith('#EXTM3U')||source.includes('#EXT-X-'));

      // iQIYI sometimes returns the HLS manifest as inline text instead of an
      // .m3u8 URL. Do not turn that text into a browser Blob: the server-side
      // stream bridge fetches the manifest from Hoshiyomi and rewrites every
      // segment/key/map URL through our proxy.
      let playbackSource=source;
      if(isInlineManifest){
        playbackSource='/api/iqiyi/stream?id='+encodeURIComponent(dramaId)
          +'&episode='+encodeURIComponent(String(selected))
          +(albumId?'&albumId='+encodeURIComponent(albumId):'');
      }else if(isDirect){
        playbackSource=makeProxyUrl(source);
      }else{
        setError('Format video iQIYI tidak dikenali.');
        return;
      }

      let recoveryCount=0;
      const instance=videojs(v,{
        controls:true,
        responsive:true,
        fluid:true,
        aspectRatio:'16:9',
        preload:'auto',
        playsinline:true,
        playbackRates:[0.5,0.75,1,1.25,1.5,2],
        html5:{
          vhs:{
            overrideNative:true,
            withCredentials:false,
            enableLowInitialPlaylist:false,
          },
          nativeAudioTracks:false,
          nativeVideoTracks:false,
        },
        controlBar:{
          pictureInPictureToggle:true,
          fullscreenToggle:true,
          remainingTimeDisplay:true,
          playbackRateMenuButton:true,
          subsCapsButton:true,
          skipButtons:{backward:10,forward:10},
        },
      });
      player.current=instance;

      void fetch('/api/iqiyi/subtitle?id='+encodeURIComponent(dramaId)
        +'&episode='+encodeURIComponent(String(selected))
        +(albumId?'&albumId='+encodeURIComponent(albumId):''))
        .then(r=>r.ok?r.json():{tracks:[]})
        .then(payload=>{
          if(cancelled||!player.current) return;
          const tracks=Array.isArray(payload?.tracks)?payload.tracks:[];
          const hasId=tracks.some((x:any)=>String(x?.language||'').toLowerCase()==='id');
          tracks.forEach((track:any,index:number)=>{
            if(!track?.src) return;
            try{
              instance.addRemoteTextTrack({
                kind:'subtitles',
                src:track.src,
                srclang:track.language||'und',
                language:track.language||'und',
                label:track.label||'Subtitle',
                default:hasId
                  ? String(track.language||'').toLowerCase()==='id'
                  : index===0,
              },false);
            }catch{}
          });
        })
        .catch(()=>{});

      instance.src({src:playbackSource,type:'application/x-mpegURL'});
      instance.on('playing',()=>{setPlaying(true);setError('');});
      instance.on('waiting',()=>setPlaying(false));
      instance.on('error',()=>{
        const mediaError=instance.error();
        if(recoveryCount<3){
          recoveryCount++;
          window.setTimeout(()=>{
            if(cancelled||!player.current) return;
            try{
              const pos=instance.currentTime();
              instance.reset();
              instance.src({src:playbackSource,type:'application/x-mpegURL'});
              instance.one('loadedmetadata',()=>{if(pos>0) try{instance.currentTime(pos);}catch{}});
              void instance.play().catch(()=>{});
            }catch{}
          },800*recoveryCount);
          return;
        }
        setPlaying(false);
        setError(mediaError?.message||'Video iQIYI gagal dimuat. Video.js sudah mencoba pemulihan beberapa kali.');
      });

      instance.ready(()=>{
        if(cancelled) return;
        void instance.play().catch(()=>{});
      });
    }).catch(e=>{
      if(!cancelled) setError(e instanceof Error?e.message:'Gagal memuat Video.js');
    });

    return()=>{
      cancelled=true;
      player.current?.dispose?.();
      player.current=null;
    };
  },[source]);

  const next=episodes[episodes.findIndex(x=>x.number===selected)+1];

  return <main className="min-h-screen bg-[#0a0e27] text-white">
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e27]/90 backdrop-blur-xl"><div className="container mx-auto flex h-14 items-center justify-between px-4"><button onClick={()=>router.back()} className="text-sm text-white/70">‹&nbsp; Kembali</button><Link href={"/detail/iqiyi/"+encodeURIComponent(dramaId)} className="text-sm text-white/70">Detail</Link></div></header>
    <div className="container mx-auto max-w-6xl px-4 py-5">
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black"><video ref={video} id="iqiyi-video-player" className="video-js vjs-big-play-centered" playsInline preload="auto"/></div>
      <h1 className="mt-5 text-xl font-bold">{title}</h1><p className="mt-1 text-sm text-white/45">Episode {selected}{playing?" • Playing":""}</p>
      {playLoading&&<div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">Menyiapkan video iQIYI...</div>}{error&&<div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error}</div>}{episodeError&&<div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-sm text-yellow-200">Episode belum berhasil dimuat. Player tetap bisa dicoba.</div>}
      {loading?<p className="mt-6 text-sm text-white/45">Memuat episode...</p>:<section className="mt-7" data-total-episodes={episodes.length}><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Episode</h2>{next&&<button onClick={()=>void play(next.number)} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black">Episode berikutnya</button>}</div><div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">{episodes.map(x=><button key={x.id+"-"+x.number} onClick={()=>void play(x.number)} className={"rounded-lg border px-3 py-2 text-sm font-semibold "+(x.number===selected?"border-emerald-400 bg-emerald-500 text-black":"border-white/10 bg-white/5 text-white/75")}>{x.number}</button>)}</div></section>}
    </div>
  </main>;
}