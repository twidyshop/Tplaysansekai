import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";

const cors = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers":"Range, Origin, Accept, Content-Type",
  "Access-Control-Expose-Headers":"Content-Type, Content-Length",
};

function urlOf(v:any):string {
  if(typeof v==="string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  if(!v || typeof v!=="object") return "";
  for(const k of ["url","src","source","file","fileUrl","file_url","subtitleUrl","subtitle_url","captionUrl","caption_url","vtt","vttUrl","vtt_url","srt","srtUrl","srt_url","uri"]){
    const x=v[k];
    if(typeof x==="string" && /^https?:\/\//i.test(x.trim())) return x.trim();
  }
  return "";
}
function langOf(v:any):string {
  if(!v || typeof v!=="object") return "";
  for(const k of ["language","lang","srclang","languageCode","language_code","languageName","language_name","locale","langCode","lang_code","code","name","label","title"]){
    const x=String(v[k]||"").trim().toLowerCase();
    if(!x) continue;
    if(/^(id|in|ind|indonesia|id-id)$/.test(x)) return "id";
    if(/^(en|eng|english|en-us|en-gb)$/.test(x)) return "en";
    if(/^(zh|zho|chi|chinese|zh-cn|zh-hans)$/.test(x)) return "zh";
    if(/^(ja|jpn|japanese)$/.test(x)) return "ja";
    if(/^(ko|kor|korean)$/.test(x)) return "ko";
    return x.slice(0,12);
  }
  return "";
}
function label(lang:string,fallback="Subtitle"){return lang==="id"?"Indonesia":lang==="en"?"English":lang==="zh"?"中文":lang==="ja"?"日本語":lang==="ko"?"한국어":fallback;}
function collect(v:any,out:any[]=[],seen=new Set<any>(),depth=0,subtitleContext=false):any[]{
  if(v==null||depth>14||typeof v!=="object"||seen.has(v))return out;
  seen.add(v);
  if(Array.isArray(v)){for(const x of v)collect(x,out,seen,depth+1,subtitleContext);return out;}
  for(const k of Object.keys(v)){
    const child=v[k],lower=k.toLowerCase(),context=subtitleContext||/subtitle|caption|closed.?caption|text.?track|captiontrack/.test(lower);
    if(context)for(const item of (Array.isArray(child)?child:[child])){
      const u=urlOf(item); if(u){const language=langOf(item),rawLabel=typeof item==="object"?String(item?.label||item?.name||item?.title||item?.languageName||item?.language_name||"").trim():"",inferred=language||langOf({language:rawLabel});out.push({url:u,language:inferred,label:rawLabel||label(inferred)});}
    }
    collect(child,out,seen,depth+1,context);
  }
  return out;
}
function proxyUrl(request:Request,target:string){return new URL("/api/wetv/subtitle?url="+encodeURIComponent(target),request.url).toString();}
function srtToVtt(s:string){
  const n=s.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").trim();
  if(!n)return "WEBVTT\n\n";
  const out=["WEBVTT",""];
  for(const block of n.split(/\n{2,}/)){const lines=block.split("\n"),i=lines.findIndex(x=>x.includes("-->"));if(i<0)continue;const timing=lines[i].replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g,"$1.$2"),text=lines.slice(i+1).join("\n").trim();if(text)out.push(timing,text,"");}
  return out.join("\n");
}
export async function OPTIONS(){return new NextResponse(null,{status:204,headers:cors});}
export async function GET(request:Request){
  const p=new URL(request.url).searchParams,url=p.get("url");
  if(url){
    try{
      const target=new URL(url);
      if(!["http:","https:"].includes(target.protocol)) throw new Error("Protocol subtitle tidak diizinkan.");
      const r=await fetch(target.toString(),{headers:{Referer:"https://wetv.vip/",Origin:"https://wetv.vip",Accept:"text/vtt,text/plain,application/x-subrip,*/*","Accept-Encoding":"identity","User-Agent":"Mozilla/5.0"},redirect:"follow",cache:"no-store"});
      const raw=await r.text();
      if(!r.ok)return new NextResponse(raw,{status:r.status,headers:{...cors,"Content-Type":"text/plain; charset=utf-8"}});
      const ct=r.headers.get("content-type")||"",isSrt=/subrip|srt/i.test(ct)||/\.srt(?:[?#]|$)/i.test(r.url||target.toString()),body=isSrt?srtToVtt(raw):raw.replace(/^\uFEFF/,"");
      return new NextResponse(body,{status:200,headers:{...cors,"Content-Type":"text/vtt; charset=utf-8","Cache-Control":"no-store"}});
    }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Gagal mengambil subtitle WeTV."},{status:502,headers:cors});}
  }
  const id=p.get("id")||"",episode=p.get("episode")||p.get("ep")||"1",key=process.env.HOSHIYOMI_API_KEY;
  if(!id)return NextResponse.json({error:"Parameter id wajib diisi."},{status:400,headers:cors});
  if(!key)return NextResponse.json({error:"HOSHIYOMI_API_KEY belum dikonfigurasi."},{status:500,headers:cors});
  const target=new URL("/api/wetv/episode",BASE);target.searchParams.set("id",id);target.searchParams.set("ep",episode);target.searchParams.set("lang","id");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
    const r=await fetch(target.toString(),{headers:{"X-API-Key":key,Accept:"application/json","User-Agent":"TPLAY+/1.0"},cache:"no-store",signal:controller.signal});
    const raw=await r.text();let data:any;try{data=JSON.parse(raw);}catch{return NextResponse.json({tracks:[],error:"Response subtitle WeTV bukan JSON."},{status:502,headers:cors});}
    if(!r.ok||data?.success===false||data?.error)return NextResponse.json({tracks:[],error:data?.message||data?.error||"Subtitle WeTV tidak tersedia."},{status:r.status||502,headers:cors});
    const seen=new Set<string>(),tracks=collect(data).filter(x=>{const k=x.url+"|"+x.language+"|"+x.label;if(seen.has(k))return false;seen.add(k);return true;}).map(x=>({label:x.language?label(x.language,x.label):x.label||"Subtitle",language:x.language||"und",src:proxyUrl(request,x.url)}));
    return NextResponse.json({tracks},{status:200,headers:{...cors,"Cache-Control":"no-store"}});
  }catch(e){clearTimeout(timer);return NextResponse.json({tracks:[],error:e instanceof Error&&e.name==="AbortError"?"Request subtitle WeTV timeout setelah 30 detik.":e instanceof Error?e.message:"Gagal mengambil subtitle WeTV."},{status:502,headers:cors});}
}