import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOSHIYOMI_BASE =
  process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const HOSHIYOMI_KEY = process.env.HOSHIYOMI_API_KEY || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Range,Content-Type",
  "Access-Control-Expose-Headers":
    "Accept-Ranges,Content-Length,Content-Range,Content-Type,ETag,Last-Modified",
};

async function resolveEpisode(id: string, ep: string, lang: string) {
  const u = new URL("/api/moboreels/episode", HOSHIYOMI_BASE);
  u.searchParams.set("id", id);
  u.searchParams.set("ep", ep);
  u.searchParams.set("lang", lang);

  const r = await fetch(u, {
    headers: {
      Accept: "application/json",
      ...(HOSHIYOMI_KEY ? { "X-API-Key": HOSHIYOMI_KEY } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });

  if (!r.ok) {
    throw new Error(`Hoshiyomi episode returned ${r.status}`);
  }

  const data = (await r.json()) as { videoUrl?: unknown };

  if (
    typeof data.videoUrl !== "string" ||
    !/^https?:\/\//i.test(data.videoUrl) ||
    !/\.mp4(?:[?#]|$)/i.test(data.videoUrl)
  ) {
    throw new Error("MoboReels episode did not return a direct MP4 videoUrl");
  }

  return data.videoUrl;
}

async function fetchMp4(url: string, range: string | null) {
  const headers = new Headers({
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "identity",
    Referer: "https://www.moboreels.com/",
  });

  if (range) headers.set("Range", range);

  const r = await fetch(url, {
    headers,
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  if (!r.ok && r.status !== 206) {
    throw new Error(`MoboReels CDN returned ${r.status}`);
  }

  return r;
}

async function handle(request: NextRequest) {
  const q = new URL(request.url).searchParams;

  let url = q.get("url");
  if (!url && q.get("id")) {
    url = await resolveEpisode(
      q.get("id")!,
      q.get("ep") || "1",
      q.get("lang") || "id",
    );
  }

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "Missing or invalid MoboReels MP4 URL" },
      { status: 400, headers: CORS },
    );
  }

  if (!/\.mp4(?:[?#]|$)/i.test(url)) {
    return NextResponse.json(
      { error: "MoboReels proxy only accepts direct MP4 URLs" },
      { status: 400, headers: CORS },
    );
  }

  const upstream = await fetchMp4(url, request.headers.get("range"));

  if (!upstream.body) {
    console.error("[Proxy Error] Empty upstream video body from MoboReels URL:", url);
    return NextResponse.json(
      { error: "Empty upstream video body" },
      { status: 500, headers: CORS },
    );
  }

  const headers = new Headers(CORS);
  headers.set("Content-Type", "video/mp4");
  headers.set("Cache-Control", "no-store");

  for (const key of [
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (error) {
    // Mencetak detail error ke log console server
    console.error("[GET Proxy Error]:", error);
    
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "MoboReels MP4 proxy failed",
      },
      { status: 500, headers: CORS }, // Diubah ke 500 agar beda dengan 502 Nginx
    );
  }
}

export async function HEAD(request: NextRequest) {
  try {
    const q = new URL(request.url).searchParams;
    let url = q.get("url");

    if (!url && q.get("id")) {
      url = await resolveEpisode(
        q.get("id")!,
        q.get("ep") || "1",
        q.get("lang") || "id",
      );
    }

    if (!url || !/^https?:\/\//i.test(url) || !/\.mp4(?:[?#]|$)/i.test(url)) {
      return new NextResponse(null, { status: 400, headers: CORS });
    }

    const upstream = await fetchMp4(url, request.headers.get("range"));
    const headers = new Headers(CORS);
    headers.set("Content-Type", "video/mp4");

    for (const key of [
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }

    return new NextResponse(null, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    // Mencetak detail error ke log console server
    console.error("[HEAD Proxy Error]:", error);
    return new NextResponse(null, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
