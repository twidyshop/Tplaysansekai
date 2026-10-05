import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOSHIYOMI_BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const HOSHIYOMI_KEY = process.env.HOSHIYOMI_API_KEY || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Range,Content-Type",
  "Access-Control-Expose-Headers": "Accept-Ranges,Content-Length,Content-Range,Content-Type,ETag,Last-Modified",
};

const PROFILES = [
  { Referer: "https://www.moboreels.com/" },
  { Referer: "https://moboreels.com/" },
  { Referer: "https://www.cdreader.com/" },
  { Referer: "https://cdreader.com/" },
  {},
];

function mediaUrl(v: string) {
  return /\.(?:mp4|m3u8|m4v|webm|mov)(?:[?#]|$)/i.test(v);
}

function pickVideo(v: unknown, depth = 0): string | null {
  if (depth > 8 || v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return /^https?:\/\//i.test(s) && (mediaUrl(s) || /(?:video|play|stream|m3u8|hls)/i.test(s)) ? s : null;
  }
  if (Array.isArray(v)) {
    for (const x of v) { const r = pickVideo(x, depth + 1); if (r) return r; }
    return null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = ["videoUrl","video_url","playUrl","play_url","streamUrl","stream_url","hls","m3u8","hlsUrl","hls_url","video","play","stream","mediaUrl","media_url","url"];
    for (const k of keys) { const r = pickVideo(o[k], depth + 1); if (r) return r; }
    for (const [k,x] of Object.entries(o)) {
      if (/cover|poster|image|thumb|avatar|logo|icon/i.test(k)) continue;
      const r = pickVideo(x, depth + 1); if (r) return r;
    }
  }
  return null;
}

async function resolveEpisode(id: string, ep: string, lang: string) {
  const u = new URL("/api/moboreels/episode", HOSHIYOMI_BASE);
  u.searchParams.set("id", id); u.searchParams.set("ep", ep); u.searchParams.set("lang", lang);
  const r = await fetch(u, {
    headers: { Accept: "application/json", ...(HOSHIYOMI_KEY ? { "X-API-Key": HOSHIYOMI_KEY } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`Hoshiyomi episode returned ${r.status}`);
  return pickVideo(await r.json());
}

async function upstream(url: string, range: string | null) {
  let status = 0;
  for (const profile of PROFILES) {
    const h = new Headers({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
      "Accept-Encoding": "identity",
      ...profile,
    });
    if (range) h.set("Range", range);
    try {
      const r = await fetch(url, { headers: h, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(30000) });
      status = r.status;
      if (r.ok || r.status === 206) return r;
    } catch {}
  }
  throw new Error(`MoboReels CDN returned ${status || "no response"}`);
}

function rewriteHls(text: string, base: string, proxy: string) {
  return text.split(/\r?\n/).map(line => {
    const t = line.trim();
    if (!t || t === "#EXTM3U") return line;
    if (t.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_, x) => `URI="${proxy}?url=${encodeURIComponent(new URL(x, base).toString())}"`);
    }
    return proxy + "?url=" + encodeURIComponent(new URL(t, base).toString());
  }).join("\n");
}

async function handle(request: NextRequest) {
  const q = new URL(request.url).searchParams;
  let url = q.get("url");
  if (!url && q.get("id")) url = await resolveEpisode(q.get("id")!, q.get("ep") || "1", q.get("lang") || "id");
  if (!url || !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Missing or invalid video URL" }, { status: 400, headers: CORS });

  const r = await upstream(url, request.headers.get("range"));
  const type = r.headers.get("content-type") || "";
  const finalUrl = r.url || url;
  const hls = /\.m3u8(?:[?#]|$)/i.test(finalUrl) || /mpegurl/i.test(type);

  if (hls) {
    const body = rewriteHls(await r.text(), finalUrl, new URL("/api/moboreels/proxy", request.url).toString());
    return new NextResponse(body, { status: r.status, headers: { ...CORS, "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8", "Cache-Control": "no-store" } });
  }

  if (!r.body) return NextResponse.json({ error: "Empty upstream video body" }, { status: 502, headers: CORS });

  const headers = new Headers(CORS);
  headers.set("Content-Type", /\.mp4(?:[?#]|$)/i.test(finalUrl) ? "video/mp4" : type || "application/octet-stream");
  headers.set("Cache-Control", "no-store");
  for (const k of ["content-length","content-range","accept-ranges","etag","last-modified"]) {
    const v = r.headers.get(k); if (v) headers.set(k, v);
  }
  return new NextResponse(r.body, { status: r.status, headers });
}

export async function GET(request: NextRequest) {
  try { return await handle(request); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "MoboReels proxy failed" }, { status: 502, headers: CORS }); }
}

export async function HEAD(request: NextRequest) {
  try {
    const r = await handle(request);
    return new NextResponse(null, { status: r.status, headers: r.headers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MoboReels proxy failed" }, { status: 502, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
