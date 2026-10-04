import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "Range,Origin,Accept,Content-Type",
    "Access-Control-Expose-Headers": "Content-Length,Content-Range,Accept-Ranges,Content-Type",
  };
}

function pick(v:any, keys:string[], fallback="") {
  for (const k of keys) {
    const x=v?.[k];
    if (typeof x==="string" && x.trim()) return x.trim();
  }
  return fallback;
}
function findStream(v:any, depth=0):string {
  if (!v || depth>12 || typeof v!=="object") return "";
  const direct=pick(v,["hlsUrl","hls","m3u8","streamUrl","stream_url","playUrl","play_url","videoUrl","video_url","url"]);
  if (/^https?:\/\//i.test(direct) || direct.startsWith("#EXTM3U") || direct.includes("#EXT-X-")) return direct;
  if (Array.isArray(v)) {
    for (const x of v) { const f=findStream(x,depth+1); if(f) return f; }
    return "";
  }
  for (const k of Object.keys(v)) { const f=findStream(v[k],depth+1); if(f) return f; }
  return "";
}
function rewriteManifest(text:string, base:URL, request:NextRequest) {
  return text.split(/\r?\n/).map(line=>{
    const t=line.trim();
    if(!t) return line;
    const rw=(raw:string)=>{
      try { return new URL("/api/wetv/proxy?url="+encodeURIComponent(new URL(raw,base).toString()),request.url).toString(); }
      catch { return raw; }
    };
    if(t.startsWith("#")) return line.replace(/URI="([^"]+)"/g,(_,raw)=>`URI="${rw(raw)}"`);
    return rw(t);
  }).join("\n");
}
export async function OPTIONS(){ return new NextResponse(null,{status:204,headers:cors()}); }

export async function GET(request:NextRequest) {
  const p=request.nextUrl.searchParams;
  const id=p.get("id")||"", episode=p.get("episode")||p.get("ep")||"1";
  const key=process.env.HOSHIYOMI_API_KEY;
  if(!id) return NextResponse.json({error:"Parameter id wajib diisi."},{status:400,headers:cors()});
  if(!key) return NextResponse.json({error:"HOSHIYOMI_API_KEY belum dikonfigurasi."},{status:500,headers:cors()});

  const target=new URL("/api/wetv/episode",BASE);
  target.searchParams.set("id",id);
  target.searchParams.set("ep",episode);
  target.searchParams.set("lang","id");

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),45000);
  try {
    const r=await fetch(target.toString(),{
      headers:{"X-API-Key":key,Accept:"application/json","User-Agent":"TPLAY+/1.0"},
      cache:"no-store",
      signal:controller.signal,
    });
    const raw=await r.text();
    if(!r.ok) return new NextResponse(raw,{status:r.status,headers:{...cors(),"Content-Type":r.headers.get("content-type")||"application/json"}});
    let data:any;
    try { data=JSON.parse(raw); } catch {
      return new NextResponse(raw,{status:502,headers:{...cors(),"Content-Type":"application/json"}});
    }
    const source=findStream(data);
    if(!source) return NextResponse.json({error:"Hoshiyomi tidak mengembalikan URL video untuk episode ini."},{status:502,headers:cors()});

    if(source.startsWith("#EXTM3U") || source.includes("#EXT-X-")) {
      return new NextResponse(source,{status:200,headers:{...cors(),"Content-Type":"application/vnd.apple.mpegurl","Cache-Control":"no-store"}});
    }

    let url:URL;
    try { url=new URL(source); } catch { return NextResponse.json({error:"URL video WeTV tidak valid."},{status:502,headers:cors()}); }
    const h=new Headers({
      Referer:"https://wetv.vip/",
      Origin:"https://wetv.vip/",
      Accept:"*/*",
      "Accept-Encoding":"identity",
      "User-Agent":request.headers.get("user-agent")||"Mozilla/5.0"
    });
    const range=request.headers.get("range"); if(range) h.set("Range",range);
    const upstream=await fetch(url.toString(),{headers:h,redirect:"follow",cache:"no-store"});
    const type=upstream.headers.get("content-type")||"";
    const final=upstream.url||url.toString();
    const manifest=type.includes("mpegurl") || /\.m3u8(?:\?|$)/i.test(final);
    if(manifest) {
      const body=await upstream.text();
      return new NextResponse(upstream.ok?rewriteManifest(body,new URL(final),request):body,{
        status:upstream.status,
        headers:{...cors(),"Content-Type":type||"application/vnd.apple.mpegurl","Cache-Control":"no-store"}
      });
    }
    const out=new Headers(cors());
    for(const k of ["content-type","content-range","accept-ranges","etag","last-modified"]){
      const v=upstream.headers.get(k); if(v) out.set(k,v);
    }
    out.set("Cache-Control","no-store");
    return new NextResponse(upstream.body,{status:upstream.status,headers:out});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error&&e.name==="AbortError"?"Request stream WeTV timeout setelah 45 detik.":e instanceof Error?e.message:"Gagal mengambil stream WeTV."},{status:502,headers:cors()});
  } finally {
    clearTimeout(timer);
  }
}