import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
function cors(){return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,HEAD,OPTIONS","Access-Control-Allow-Headers":"Range,Origin,Accept,Content-Type","Access-Control-Expose-Headers":"Content-Length,Content-Range,Accept-Ranges,Content-Type"};}
function rewrite(text:string,base:URL,request:NextRequest){return text.split(/\r?\n/).map(line=>{const t=line.trim();if(!t)return line;const rw=(raw:string)=>{try{return new URL("/api/wetv/proxy?url="+encodeURIComponent(new URL(raw,base).toString()),request.url).toString();}catch{return raw;}};if(t.startsWith("#"))return line.replace(/URI="([^"]+)"/g,(_,raw)=>`URI="${rw(raw)}"`);return rw(t);}).join("\n");}
export async function OPTIONS(){return new NextResponse(null,{status:204,headers:cors()});}
export async function GET(request:NextRequest){
 const target=request.nextUrl.searchParams.get("url");if(!target)return NextResponse.json({error:"Parameter url wajib diisi."},{status:400,headers:cors()});
 let url:URL;try{url=new URL(target);}catch{return NextResponse.json({error:"URL tidak valid."},{status:400,headers:cors()});}
 if(!["http:","https:"].includes(url.protocol))return NextResponse.json({error:"Protocol URL tidak diizinkan."},{status:400,headers:cors()});
 try{
  const h=new Headers({Referer:"https://wetv.vip/",Origin:"https://wetv.vip/",Accept:"*/*","Accept-Encoding":"identity","User-Agent":request.headers.get("user-agent")||"Mozilla/5.0"});
  const range=request.headers.get("range");if(range)h.set("Range",range);
  const upstream=await fetch(url.toString(),{headers:h,redirect:"follow",cache:"no-store"});
  const type=upstream.headers.get("content-type")||"",final=upstream.url||url.toString();
  const manifest=type.includes("mpegurl")||/\.m3u8(?:\?|$)/i.test(final)||/\.m3u8(?:\?|$)/i.test(url.toString());
  if(manifest){const body=await upstream.text();return new NextResponse(upstream.ok?rewrite(body,new URL(final),request):body,{status:upstream.status,headers:{...cors(),"Content-Type":type||"application/vnd.apple.mpegurl","Cache-Control":"no-store"}});}
  const out=new Headers(cors());for(const k of ["content-type","content-range","accept-ranges","etag","last-modified"]){const v=upstream.headers.get(k);if(v)out.set(k,v);}out.set("Cache-Control","no-store");return new NextResponse(upstream.body,{status:upstream.status,headers:out});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Gagal mengambil resource WeTV."},{status:502,headers:cors()});}
}
