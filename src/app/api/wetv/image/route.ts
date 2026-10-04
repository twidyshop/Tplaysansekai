import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headers() {
  return {"Access-Control-Allow-Origin":"*","Cache-Control":"public, max-age=0, s-maxage=86400, stale-while-revalidate=604800","X-Content-Type-Options":"nosniff"};
}
export async function GET(request:Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return NextResponse.json({error:"Parameter url wajib diisi."},{status:400,headers:headers()});
  let url:URL;
  try { url=new URL(target); } catch { return NextResponse.json({error:"URL gambar tidak valid."},{status:400,headers:headers()}); }
  if (!["http:","https:"].includes(url.protocol)) return NextResponse.json({error:"Protocol gambar tidak diizinkan."},{status:400,headers:headers()});
  try {
    const upstream=await fetch(url.toString(),{headers:{Accept:"image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8","User-Agent":"Mozilla/5.0"},redirect:"follow",cache:"no-store"});
    const type=(upstream.headers.get("content-type")||"").toLowerCase();
    let response=upstream;
    if (!upstream.ok || !type.startsWith("image/")) {
      const fallback=await fetch(`https://wsrv.nl/?url=${encodeURIComponent(url.toString())}&output=jpg&q=88&w=1200`,{headers:{Accept:"image/jpeg,image/*;q=0.8","User-Agent":"Mozilla/5.0"},redirect:"follow",cache:"no-store"});
      if (!fallback.ok || !(fallback.headers.get("content-type")||"").toLowerCase().startsWith("image/")) return new NextResponse("Image upstream failed",{status:502,headers:headers()});
      response=fallback;
    }
    const input=Buffer.from(await response.arrayBuffer());
    const jpeg=await sharp(input).rotate().flatten({background:"#ffffff"}).jpeg({quality:88,progressive:false,mozjpeg:true}).toBuffer();
    const out=new Headers(headers()); out.set("Content-Type","image/jpeg"); out.set("Content-Length",String(jpeg.byteLength));
    return new NextResponse(jpeg.buffer.slice(jpeg.byteOffset,jpeg.byteOffset+jpeg.byteLength) as ArrayBuffer,{status:200,headers:out});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Gagal mengambil gambar."},{status:502,headers:headers()});
  }
}
