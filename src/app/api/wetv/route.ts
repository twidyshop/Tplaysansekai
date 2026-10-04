import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 600;
export const maxDuration = 60;

const BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const ACTIONS = new Set(["home","anime","search","detail","episodes","play"]);

function makeUrl(path: string, params: Record<string,string|undefined>) {
  const u = new URL(path, BASE);
  for (const [k,v] of Object.entries(params)) if (v) u.searchParams.set(k,v);
  return u;
}
function cacheHeaders(action:string) {
  return action === "play" || action === "episodes"
    ? {"Cache-Control":"no-store"}
    : {"Cache-Control":"public, s-maxage=600, stale-while-revalidate=86400"};
}
export async function GET(request:Request) {
  const p = new URL(request.url).searchParams;
  const action = p.get("action") || "";
  if (!ACTIONS.has(action)) return NextResponse.json({error:"Invalid WeTV action"},{status:400});
  const key = process.env.HOSHIYOMI_API_KEY;
  if (!key) return NextResponse.json({error:"HOSHIYOMI_API_KEY belum dikonfigurasi di Vercel."},{status:500});

  const id = p.get("id") || "";
  let target:URL;
  switch(action) {
    case "home":
      target = makeUrl("/api/wetv/trending",{lang:"id",page:p.get("page")||"1",limit:p.get("limit")||"30"});
      break;
    case "anime":
      target = makeUrl("/api/wetv/anime",{lang:"id",page:p.get("page")||"1"});
      break;
    case "search": {
      const q = p.get("query") || p.get("q") || "";
      if (!q) return NextResponse.json({error:"Parameter query wajib diisi."},{status:400});
      target = makeUrl("/api/wetv/search",{q,lang:"id",page:p.get("page")||"1",type:p.get("type")||undefined,limit:p.get("limit")||"30"});
      break;
    }
    case "detail":
      if (!id) return NextResponse.json({error:"Parameter id wajib diisi."},{status:400});
      target = makeUrl("/api/wetv/detail",{id,lang:"id"});
      break;
    case "episodes":
      if (!id) return NextResponse.json({error:"Parameter id wajib diisi."},{status:400});
      target = makeUrl("/api/wetv/detail",{id,lang:"id"});
      break;
    case "play":
      if (!id) return NextResponse.json({error:"Parameter id wajib diisi."},{status:400});
      target = makeUrl("/api/wetv/episode",{id,ep:p.get("ep")||p.get("episode")||"1",lang:"id"});
      break;
    default: return NextResponse.json({error:"Invalid WeTV action"},{status:400});
  }

  const controller = new AbortController();
  const timeoutMs = action === "play" ? 45000 : action === "episodes" ? 30000 : 30000;
  const timeout = setTimeout(()=>controller.abort(),timeoutMs);
  try {
    console.log(`[WeTV] ${action} -> ${target.pathname}${target.search}`);
    if (action === "episodes") {
      const response = await fetch(target.toString(),{headers:{"X-API-Key":key,Accept:"application/json","User-Agent":"TPLAY+/1.0"},cache:"no-store",signal:controller.signal});
      clearTimeout(timeout);
      const raw = await response.text();
      let data:any;
      try { data=JSON.parse(raw); } catch { return NextResponse.json({episodes:[],error:"Hoshiyomi mengembalikan response non-JSON."},{status:502,headers:cacheHeaders(action)}); }
      if (!response.ok || data?.success === false || data?.error) return NextResponse.json({episodes:[],error:data?.message||data?.error||"Detail WeTV tidak tersedia."},{status:response.status||502,headers:cacheHeaders(action)});
      const episodeArrays:any[][]=[]; const seen=new Set<any>();
      const walk=(v:any,d=0)=>{if(v==null||d>12||typeof v!=="object"||seen.has(v))return;seen.add(v);if(Array.isArray(v)){if(v.length&&v.some((x:any)=>x&&typeof x==="object"&&Object.keys(x).some((k:string)=>/episode|chapter/i.test(k))))episodeArrays.push(v);for(const x of v)walk(x,d+1);return;}for(const k of Object.keys(v))walk(v[k],d+1);};
      walk(data);
      let list:any[]=[]; for(const x of episodeArrays)if(x.length>list.length)list=x.filter((v:any)=>v&&typeof v==="object");
      const countKeys=["episodeCount","episode_count","totalEpisodes","total_episodes","episodeTotal","totalEpisode","episodesCount","chapterCount","totalChapters"];
      const findCount=(v:any,d=0):number=>{if(v==null||d>10||typeof v!=="object")return 0;for(const k of countKeys){const n=Number(v[k]);if(Number.isFinite(n)&&n>0&&n<=1000)return Math.floor(n);}if(Array.isArray(v))for(const x of v){const n=findCount(x,d+1);if(n)return n;}else for(const k of Object.keys(v)){const n=findCount(v[k],d+1);if(n)return n;}return 0;};
      const count=findCount(data); if(!list.length&&count)list=Array.from({length:count},(_,i)=>({episode:i+1,number:i+1}));
      const normalized=list.map((x:any,i:number)=>({id:String(x?.id??x?.episodeId??x?.episode_id??x?.videoId??x?.video_id??x?.number??x?.episode??i+1),episode:Number(x?.episode??x?.episodeNumber??x?.episode_no??x?.episodeNo??x?.ep??x?.number??x?.seq??x?.index??i+1)||i+1,title:String(x?.title??x?.name??x?.episodeTitle??("Episode "+(i+1)))})).filter((x:any)=>x.episode>0).sort((a:any,b:any)=>a.episode-b.episode);
      return NextResponse.json({episodes:normalized},{status:200,headers:cacheHeaders(action)});
    }

    const response = await fetch(target.toString(),{
      headers:{"X-API-Key":key,Accept:"application/json","User-Agent":"TPLAY+/1.0"},
      cache:"no-store",
      signal:controller.signal,
    });
    clearTimeout(timeout);
    const raw = await response.text();
    console.log(`[WeTV] ${action} <- ${response.status} (${raw.length} bytes)`);
    let data:any;
    try { data=JSON.parse(raw); } catch {
      return NextResponse.json({error:"Hoshiyomi mengembalikan response non-JSON.",status:response.status},{status:response.ok?502:response.status,headers:cacheHeaders(action)});
    }
    if (!response.ok || data?.success === false || data?.error) {
      if (action === "detail") return NextResponse.json({success:false,data:{},error:data?.message||data?.error||"Detail WeTV sementara tidak tersedia",action},{status:200,headers:cacheHeaders(action)});
      return NextResponse.json({error:data?.message||data?.error||"Hoshiyomi request failed",status:response.status,action},{status:response.status,headers:cacheHeaders(action)});
    }
    return NextResponse.json(data,{status:response.status,headers:cacheHeaders(action)});
  } catch(error) {
    clearTimeout(timeout);
    if (action === "detail") return NextResponse.json({success:false,data:{},error:"Detail WeTV sedang timeout.",action},{status:200,headers:cacheHeaders(action)});
    return NextResponse.json({error:error instanceof Error&&error.name==="AbortError"?`Request WeTV timeout setelah ${timeoutMs/1000} detik.`:error instanceof Error?error.message:"Hoshiyomi request failed",action},{status:502,headers:cacheHeaders(action)});
  }
}