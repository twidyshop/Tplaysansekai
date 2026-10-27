"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import {Menu, X, ChevronLeft, ChevronRight} from "lucide-react";
import {useIqiyiDetail,useIqiyiEpisodes,useIqiyiPlay} from "@/hooks/useIqiyi";
import {useWatchHistoryStore} from "@/hooks/useWatchHistory";

function arr(v:any,depth=0):any[]{
  if(depth>10||v==null||typeof v!=="object") return [];
  if(Array.isArray(v)){
    if(v.length===0) return [];
    const looksLikeEpisodes=v.some((x:any)=>x&&typeof x==="object"&&["episode","episodeNumber","episode_index","episodeId","episode_id","chapterId","chapter_id","videoId","video_id","playUrl","play_url"].some(k=>x[k]!=null));
    return looksLikeEpisodes?v:[];
  }
  const preferred=["episodes","episodeList","episode_list","episodeData","episode_data","allepisode","allEpisode","chapters","chapterList","chapter_list","videos","videoList","video_list","list","rows","results","items","data","result"];
  for(const k of preferred){ if(v[k]==null) continue; const found=arr(v[k],depth+1); if(found.length) return found; }
  for(const value of Object.values(v)){ const found=arr(value,depth+1); if(found.length) return found; }
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
  const playerHost=useRef<HTMLDivElement|null>(null),player=useRef<any>(null);
  const lastSeekTap=useRef<{direction:number;time:number}|null>(null),seekFeedbackTimer=useRef<number|null>(null);
  const [selected,setSelected]=useState(1),[source,setSource]=useState(""),[error,setError]=useState(""),[playing,setPlaying]=useState(false),[castReady,setCastReady]=useState(false),[castSource,setCastSource]=useState(""),[seekFeedback,setSeekFeedback]=useState(""),[episodeMenuOpen,setEpisodeMenuOpen]=useState(false);
  const addHistory=useWatchHistoryStore((state)=>state.addItem);
  const detailQuery=useIqiyiDetail(dramaId,albumId);
  const episodesQuery=useIqiyiEpisodes(dramaId,albumId);
  const playQuery=useIqiyiPlay(dramaId,selected,albumId);
  const rawEpisodes=arr(episodesQuery.data).length?arr(episodesQuery.data):arr(detailQuery.data);
  const episodes=rawEpisodes.map((x:any,i:number)=>({
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
    let cancelled=false;
    const w=window as any;
    if(w.cast?.framework&&w.chrome?.cast) {
      w.cast.framework.CastContext.getInstance().setOptions({
        receiverApplicationId:w.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy:w.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });
      setCastReady(true);
      return;
    }

    const previous=w.__onGCastApiAvailable;
    w.__onGCastApiAvailable=(isAvailable:boolean)=>{
      if(typeof previous==='function') previous(isAvailable);
      if(cancelled||!isAvailable||!w.cast?.framework||!w.chrome?.cast) return;
      w.cast.framework.CastContext.getInstance().setOptions({
        receiverApplicationId:w.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy:w.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });
      setCastReady(true);
    };

    if(!document.querySelector('script[data-tplay-cast]')){
      const script=document.createElement('script');
      script.src='https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async=true;
      script.dataset.tplayCast='1';
      document.head.appendChild(script);
    }

    return()=>{
      cancelled=true;
      w.__onGCastApiAvailable=previous;
    };
  },[]);

  const castCurrentVideo=useCallback(async()=>{
    const w=window as any;
    if(!castReady||!castSource||!w.cast?.framework||!w.chrome?.cast) return;
    try{
      const context=w.cast.framework.CastContext.getInstance();
      let session=context.getCurrentSession();
      if(!session) {
        await context.requestSession();
        session=context.getCurrentSession();
      }
      if(!session) return;
      const mediaInfo=new w.chrome.cast.media.MediaInfo(castSource,'application/x-mpegURL');
      mediaInfo.streamType=w.chrome.cast.media.StreamType.BUFFERED;
      mediaInfo.metadata=new w.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title=title;
      const request=new w.chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(request);
    }catch{}
  },[castReady,castSource,title]);

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
  useEffect(()=>{
    if(!dramaId || !title || title === "iQIYI" || !episodes.length) return;

    const detailSource=detailQuery.data?.data?.detail??detailQuery.data?.data?.drama??detailQuery.data?.data?.album??detailQuery.data?.data??detailQuery.data;
    const image=deepText(detailSource,["cover","coverUrl","cover_url","poster","posterUrl","poster_url","image","imageUrl","image_url","thumbnail","thumbnailUrl","albumCover","album_cover"],"");

    addHistory({
      id:dramaId,
      title,
      image,
      platform:"Iqiyi",
      timestamp:Date.now(),
      url:window.location.pathname+window.location.search+window.location.hash,
      episode:selected,
      totalEpisodes:episodes.length,
    });
  },[dramaId,title,selected,episodes.length,detailQuery.data,addHistory]);


  const play=useCallback((n:number)=>{
    setSelected(n);setSource("");setError("");setPlaying(false);
  },[]);

  const handleSeekTap=useCallback((direction:-1|1)=>{
    const now=Date.now();
    const previous=lastSeekTap.current;
    if(previous&&previous.direction===direction&&now-previous.time<320){
      lastSeekTap.current=null;
      const instance=player.current;
      if(!instance) return;
      try{
        const current=Number(instance.currentTime())||0;
        const duration=Number(instance.duration());
        const target=Math.max(0,Math.min(Number.isFinite(duration)&&duration>0?duration:current+10,current+direction*10));
        instance.currentTime(target);
        setSeekFeedback(direction===1?"+10s":"−10s");
        if(seekFeedbackTimer.current!==null) window.clearTimeout(seekFeedbackTimer.current);
        seekFeedbackTimer.current=window.setTimeout(()=>setSeekFeedback(""),650);
      }catch{}
    }else{
      lastSeekTap.current={direction,time:now};
    }
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
      if(cancelled||!playerHost.current||!source) return;
      const videojs=(window as any).videojs;
      if(!videojs) throw new Error('Engine Video.js tidak tersedia.');

      player.current?.dispose?.();
      player.current=null;

      const host=playerHost.current;
      if(!host) return;
      // Video.js mutates and removes nodes it owns. Keep its video element outside
      // React's child reconciliation so changing episodes cannot trigger removeChild crashes.
      host.replaceChildren();
      const v=document.createElement("video");
      v.className="video-js vjs-big-play-centered";
      v.playsInline=true;
      v.preload="auto";
      host.appendChild(v);
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
      setCastSource(playbackSource);

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
        },
      });
      player.current=instance;

      // Keep Video.js controls (especially CC/subtitles) above the transparent
      // double-tap seek zones, which otherwise can intercept taps on the CC button.
      const controlStyleId='tplay-iqiyi-controlbar-layer';
      if(!document.getElementById(controlStyleId)){
        const controlStyle=document.createElement('style');
        controlStyle.id=controlStyleId;
        controlStyle.textContent='.video-js .vjs-control-bar{z-index:30!important}.video-js .vjs-text-track-settings{z-index:40!important}.video-js .vjs-menu{z-index:40!important}';
        document.head.appendChild(controlStyle);
      }

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
      instance.on('ended',()=>{
        const currentIndex=episodes.findIndex((episode:any)=>episode.number===selected);
        const following=currentIndex>=0?episodes[currentIndex+1]:null;
        if(following) play(following.number);
      });
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
      const activePlayer=player.current;
      player.current=null;
      try{activePlayer?.dispose?.();}catch{}
      // The host is React-owned, but its children are intentionally player-owned.
      const host=playerHost.current;
      if(host) host.replaceChildren();
    };
  },[source]);

  const next=episodes[episodes.findIndex(x=>x.number===selected)+1];

  return <main className="min-h-screen bg-[#0a0e27] text-white">
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e27]/90 backdrop-blur-xl"><div className="container mx-auto flex h-14 items-center justify-between px-4"><button onClick={()=>router.back()} className="text-sm text-white/70">‹&nbsp; Kembali</button><Link href={"/detail/iqiyi/"+encodeURIComponent(dramaId)} className="text-sm text-white/70">Detail</Link></div></header>
    <div className="container mx-auto max-w-6xl px-4 py-5">
      <div className="relative isolate aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div ref={playerHost} className="absolute inset-0" />
        <button type="button" aria-label="Ketuk dua kali untuk mundur 10 detik" onClick={()=>handleSeekTap(-1)} className="absolute top-0 bottom-12 left-0 z-10 w-[30%] touch-manipulation bg-transparent focus:outline-none" />
        <button type="button" aria-label="Ketuk dua kali untuk maju 10 detik" onClick={()=>handleSeekTap(1)} className="absolute top-0 bottom-12 right-0 z-10 w-[30%] touch-manipulation bg-transparent focus:outline-none" />
        {seekFeedback&&<div className={"pointer-events-none absolute inset-y-0 z-20 flex items-center "+(seekFeedback.startsWith("+")?"right-[12%]":"left-[12%]")}>
          <div className="rounded-full bg-black/65 px-4 py-3 text-lg font-bold text-white shadow-lg">{seekFeedback.startsWith("+")?"⏩ ":"⏪ "}{seekFeedback}</div>
        </div>}
        <>
          <button type="button" onClick={()=>setEpisodeMenuOpen(open=>!open)} aria-label="Buka daftar episode" className="absolute right-3 top-3 z-[70] flex items-center gap-2 rounded-lg border border-white/20 bg-black/90 px-3 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md">
            {episodeMenuOpen?<X className="h-4 w-4"/>:<Menu className="h-4 w-4"/>} Episode {selected}
          </button>
          {episodeMenuOpen&&<div className="absolute inset-x-3 top-14 z-[80] max-h-[65%] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e27]/[98] p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-bold">Daftar Episode</p><p className="text-[11px] text-white/50">{title} · {episodes.length} episode</p></div><button type="button" onClick={()=>setEpisodeMenuOpen(false)} className="rounded-lg p-2 text-white/60 hover:bg-white/10" aria-label="Tutup daftar episode"><X className="h-4 w-4"/></button></div>
            {loading?<p className="py-5 text-center text-sm text-white/60">Memuat daftar episode...</p>:episodes.length>0?<div className="grid grid-cols-5 gap-2 sm:grid-cols-7 md:grid-cols-9">{episodes.map((episode:any)=><button key={episode.id+"-"+episode.number} type="button" onClick={()=>{void play(episode.number);setEpisodeMenuOpen(false);}} className={"rounded-lg border px-2 py-2.5 text-xs font-bold "+(episode.number===selected?"border-emerald-400 bg-emerald-500 text-black":"border-white/10 bg-white/5 text-white/75 hover:bg-white/10")}>{episode.number}</button>)}</div>:<p className="py-5 text-center text-sm text-amber-200">{episodeError||"Daftar episode belum tersedia dari sumber iQIYI."}</p>}
          </div>}
        </>
      </div>{castReady&&castSource&&<button type="button" onClick={()=>void castCurrentVideo()} className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">📺 Cast ke Android TV</button>}
      <h1 className="mt-5 text-xl font-bold">{title}</h1><p className="mt-1 text-sm text-white/45">Episode {selected}{playing?" • Playing":""}</p>
      {playLoading&&<div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">Menyiapkan video iQIYI...</div>}{error&&<div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error}</div>}{episodeError&&<div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-sm text-yellow-200">Episode belum berhasil dimuat. Player tetap bisa dicoba.</div>}
      {loading&&<p className="mt-4 text-sm text-white/45">Memuat episode...</p>}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <button type="button" disabled={!episodes.some((episode:any)=>episode.number===selected)&&selected<=1||!episodes.length||episodes.findIndex((episode:any)=>episode.number===selected)<=0} onClick={()=>{const index=episodes.findIndex((episode:any)=>episode.number===selected);if(index>0)void play(episodes[index-1].number);}} className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 disabled:opacity-30"><ChevronLeft className="h-4 w-4"/> Sebelumnya</button>
        <div className="min-w-0 flex-1 text-center"><p className="truncate text-sm font-bold">{title}</p><p className="mt-1 text-xs text-white/45">Episode {selected}{playing?" • Playing":""}</p></div>
        <button type="button" disabled={!next} onClick={()=>next&&void play(next.number)} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-30">Selanjutnya <ChevronRight className="h-4 w-4"/></button>
      </div>
    </div>
  </main>;
}
