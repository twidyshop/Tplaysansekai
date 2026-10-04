import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 600;

const BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const ACTIONS = new Set(["home","search","detail","episodes","play"]);

function target(action: string, p: URLSearchParams) {
  const u = new URL(`/api/moboreels/${action === "home" ? "trending" : action === "episodes" ? "allepisode" : action === "play" ? "episode" : action}`, BASE);
  const keys = action === "search" ? ["q","query","lang","page"] : action === "play" ? ["id","ep","episode","lang"] : ["id","lang"];
  if (action === "home") { u.searchParams.set("lang", p.get("lang") || "id"); u.searchParams.set("page", p.get("page") || "1"); }
  else for (const k of keys) { const v=p.get(k); if(v) u.searchParams.set(k,v); }
  return u;
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const action = p.get("action") || "";
  if (!ACTIONS.has(action)) return NextResponse.json({error:"Invalid MoboReels action"},{status:400});
  const key = process.env.HOSHIYOMI_API_KEY;
  if (!key) return NextResponse.json({error:"HOSHIYOMI_API_KEY belum dikonfigurasi di Vercel."},{status:500});
  if (["detail","episodes","play"].includes(action) && !p.get("id")) return NextResponse.json({error:"Parameter id wajib diisi."},{status:400});
  if (action === "search" && !(p.get("q") || p.get("query"))) return NextResponse.json({error:"Parameter query wajib diisi."},{status:400});
  const url=target(action,p); const timeoutMs=action==="play"?25000:15000;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    console.log(`[MoboReels] ${action} -> ${url.pathname}${url.search}`);
    const r=await fetch(url,{headers:{"X-API-Key":key,Accept:"application/json","User-Agent":"TPLAY+/1.0"},cache:"no-store",signal:controller.signal});
    const raw=await r.text(); clearTimeout(timer);
    console.log(`[MoboReels] ${action} <- ${r.status} (${raw.length} bytes)`);
    let data:any; try{data=JSON.parse(raw)}catch{return NextResponse.json({error:"Hoshiyomi mengembalikan response non-JSON.",status:r.status},{status:502});}
    if(!r.ok || data?.success===false || data?.error) return NextResponse.json({error:data?.message||data?.error||"Hoshiyomi request failed",status:r.status,action},{status:r.status});
    return NextResponse.json(data,{status:r.status,headers:{"Cache-Control":action==="play"?"no-store":"public, s-maxage=600, stale-while-revalidate=86400"}});
  } catch(e) {
    clearTimeout(timer);
    return NextResponse.json({error:e instanceof Error && e.name==="AbortError"?`Request MoboReels timeout setelah ${timeoutMs/1000} detik.`:e instanceof Error?e.message:"Hoshiyomi request failed",action},{status:502});
  }
}
