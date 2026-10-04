import { NextResponse } from "next/server";
import sharp from "sharp";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(request:Request){
  const src=new URL(request.url).searchParams.get("url");
  if(!src) return NextResponse.json({error:"Missing url"},{status:400});
  try{
    const r=await fetch(src,{headers:{"User-Agent":"Mozilla/5.0","Accept":"image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"},cache:"no-store"});
    if(!r.ok) throw new Error(`upstream ${r.status}`);
    const input=Buffer.from(await r.arrayBuffer());
    const out=await sharp(input).jpeg({quality:88}).toBuffer();
    return new NextResponse(out,{headers:{"Content-Type":"image/jpeg","Cache-Control":"public, max-age=86400, s-maxage=604800","Access-Control-Allow-Origin":"*"}});
  }catch(e){
    try{
      const proxy="https://wsrv.nl/?url="+encodeURIComponent(src);
      const r=await fetch(proxy,{cache:"no-store"}); if(!r.ok) throw new Error("proxy failed");
      const out=await sharp(Buffer.from(await r.arrayBuffer())).jpeg({quality:88}).toBuffer();
      return new NextResponse(out,{headers:{"Content-Type":"image/jpeg","Cache-Control":"public, max-age=86400, s-maxage=604800","Access-Control-Allow-Origin":"*"}});
    }catch{return NextResponse.json({error:"Image proxy failed"},{status:502});}
  }
}
