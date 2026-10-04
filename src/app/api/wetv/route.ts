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
      target = makeUrl("/api/wetv/trending",{lang:"id",type:"anime",page:p.get("page")||"1",limit:p.get("limit")||"30"});
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
      target = makeUrl("/api/wetv/episodes",{id,lang:"id",page:p.get("page")||"1",limit:p.get("limit")||"100"});
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