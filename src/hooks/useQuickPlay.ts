import { useQuery } from "@tanstack/react-query";
import type { Drama } from "@/types/drama";

export type QuickPlayPlatform = "stardusttv" | "microdrama";

function text(v:any){return typeof v==="string"?v.trim():v==null?"":String(v).trim();}
function list(v:any):any[]{if(Array.isArray(v))return v;if(!v||typeof v!=="object")return [];for(const k of ["data","list","items","results","dramas","books","records"]){if(Array.isArray(v[k]))return v[k];const x=list(v[k]);if(x.length)return x;}return [];}
function pick(v:any,keys:string[]){for(const k of keys){const x=text(v?.[k]);if(x)return x;}return "";}

export function mapQuickPlayDrama(v:any):Drama{
 const id=pick(v,["id","bookId","book_id","dramaId","drama_id","videoId"]);
 const title=pick(v,["title","bookName","book_name","dramaName","name"])||"Untitled";
 const cover=pick(v,["cover","coverUrl","cover_url","poster","posterUrl","image","thumbnail","book_pic"]);
 const introduction=pick(v,["synopsis","introduction","description","desc","summary"]);
 const chapterCount=Number(v?.chapterCount??v?.chapter_count??v?.episodeCount??v?.episode_count??v?.totalEpisodes??v?.total_episodes??0);
 return {bookId:id,bookName:title,cover,coverWap:cover,chapterCount:Number.isFinite(chapterCount)?chapterCount:0,introduction,tags:[],inLibrary:Boolean(v?.inLibrary)};
}

async function request(platform:QuickPlayPlatform,path:string,params:Record<string,string>={}){
 const qs=new URLSearchParams({path,category_p:platform,lang:"id",...params});
 const res=await fetch("/api/"+platform+"?"+qs.toString(),{cache:"no-store"});
 const raw=await res.text(); let json:any; try{json=JSON.parse(raw)}catch{throw new Error("QuickPlay mengembalikan respons bukan JSON (HTTP "+res.status+")");}
 if(!res.ok||json?.success===false)throw new Error(json?.error||json?.message||("QuickPlay HTTP "+res.status));
 return json;
}

export function useQuickPlayHome(platform:QuickPlayPlatform){
 return useQuery({queryKey:["quickplay-home",platform],queryFn:async()=>list(await request(platform,"/api/v2/homeDrama")).map(mapQuickPlayDrama).filter(x=>x.bookId),staleTime:300000,retry:2});
}
export function useQuickPlaySearch(platform:QuickPlayPlatform,q:string){
 const keyword=q.trim();
 return useQuery({queryKey:["quickplay-search",platform,keyword],enabled:!!keyword,queryFn:async()=>list(await request(platform,"/api/v2/search",{keyword})).map(mapQuickPlayDrama).filter(x=>x.bookId),staleTime:120000,retry:1});
}
export async function getQuickPlayDetail(platform:QuickPlayPlatform,id:string){return request(platform,"/api/v2/detailDrama",{id});}
export async function getQuickPlayStream(platform:QuickPlayPlatform,id:string,episode:string){return request(platform,"/api/v2/videoStream",{id,episode});}

export function extractStream(json:any){
 let url=""; const subtitles:any[]=[]; const seen=new Set<any>();
 const walk=(v:any,d=0):void=>{if(d>8||v==null||url&&subtitles.length>20)return;if(typeof v==="object"){if(seen.has(v))return;seen.add(v);}
  if(typeof v==="string"){if(!url&&/^https?:\\/\\//i.test(v))url=v;return;}
  if(Array.isArray(v)){v.forEach(x=>walk(x,d+1));return;}
  for(const [k,val] of Object.entries(v)){const key=k.toLowerCase();
   if(typeof val==="string"&&/^https?:\\/\\//i.test(val)){
    if(key.includes("subtitle")||key.includes("caption")||key.includes("suburl"))subtitles.push({url:val,languageCode:"id"});
    else if(!url&&(key.includes("video")||key.includes("stream")||key.includes("play")||key==="url"||key.includes("mp4")||key.includes("m3u8")))url=val;
   } else walk(val,d+1);
  }
 };
 walk(json); return {url,subtitles};
}