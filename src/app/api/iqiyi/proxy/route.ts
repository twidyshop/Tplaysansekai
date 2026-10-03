import { NextResponse } from "next/server";

function rewriteManifest(manifest:string,baseUrl:URL){
  return manifest.split("\n").map(line=>{
    let out=line;
    const trimmed=line.trim();
    if(!trimmed) return line;

    // Rewrite URI attributes used by HLS keys, maps, media playlists, etc.
    out=out.replace(/URI="([^"]+)"/g,(_,raw)=>{
      try{
        const absolute=new URL(raw,baseUrl).toString();
        return 'URI="/api/iqiyi/proxy?url='+encodeURIComponent(absolute)+'"';
      }catch{return _}
    });

    // Rewrite ordinary playlist resource lines.
    if(!trimmed.startsWith("#")){
      try{
        const absolute=new URL(trimmed,baseUrl).toString();
        out="/api/iqiyi/proxy?url="+encodeURIComponent(absolute);
      }catch{}
    }
    return out;
  }).join("\n");
}

export async function GET(request:Request){
  const {searchParams}=new URL(request.url);
  const target=searchParams.get("url");
  if(!target) return NextResponse.json({error:"Parameter url wajib diisi."},{status:400});

  let url:URL;
  try{url=new URL(target)}catch{return NextResponse.json({error:"URL tidak valid."},{status:400})}
  if(!["http:","https:"].includes(url.protocol)) return NextResponse.json({error:"Protocol URL tidak diizinkan."},{status:400});

  try{
    const response=await fetch(url.toString(),{
      headers:{
        Referer:"https://www.iq.com/",
        Origin:"https://www.iq.com",
        Accept:"*/*",
        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
      },
      cache:"no-store",
    });

    if(!response.ok) return new NextResponse(await response.arrayBuffer(),{status:response.status,headers:{
      "Content-Type":response.headers.get("content-type")||"application/octet-stream",
      "Access-Control-Allow-Origin":"*",
      "Cache-Control":"public, max-age=60",
    }});

    const contentType=response.headers.get("content-type")||"";
    const isManifest=contentType.includes("mpegurl")||/\.m3u8(?:\?|$)/i.test(url.pathname+url.search);

    if(isManifest){
      const manifest=await response.text();
      return new NextResponse(rewriteManifest(manifest,url),{
        status:200,
        headers:{
          "Content-Type":"application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin":"*",
          "Cache-Control":"public, s-maxage=30, stale-while-revalidate=60",
        },
      });
    }

    return new NextResponse(await response.arrayBuffer(),{
      status:response.status,
      headers:{
        "Content-Type":contentType||"application/octet-stream",
        "Access-Control-Allow-Origin":"*",
        "Cache-Control":"public, max-age=3600, s-maxage=3600",
        "Accept-Ranges":"bytes",
      },
    });
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Gagal mengambil resource iQIYI."},{status:502});
  }
}
