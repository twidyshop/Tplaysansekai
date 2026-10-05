import { NextRequest, NextResponse } from "next/server";

// FIX UTAMA: Gunakan Edge Runtime agar mendukung Streaming Video tanpa batas ukuran.
// Ini akan menghindari limit 4.5MB dan timeout 60s dari Node.js Vercel.
export const runtime = "edge"; 

const HOSHIYOMI_BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const HOSHIYOMI_KEY = process.env.HOSHIYOMI_API_KEY || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Range,Content-Type",
  "Access-Control-Expose-Headers": "Accept-Ranges,Content-Length,Content-Range,Content-Type,ETag,Last-Modified",
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
  });

  if (!r.ok) {
    throw new Error(`Hoshiyomi API Error: ${r.status}`);
  }

  const data = (await r.json()) as { videoUrl?: unknown };

  if (typeof data.videoUrl !== "string") {
    throw new Error("MoboReels episode did not return a valid videoUrl");
  }

  return data.videoUrl;
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;

    let url = q.get("url");
    if (!url && q.get("id")) {
      url = await resolveEpisode(q.get("id")!, q.get("ep") || "1", q.get("lang") || "id");
    }

    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400, headers: CORS });
    }

    // Manipulasi Header untuk mengelabui proteksi CDN MoboReels
    const fetchHeaders = new Headers();
    fetchHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
    fetchHeaders.set("Referer", "https://www.moboreels.com/"); // Wajib ada agar tidak 403
    fetchHeaders.set("Accept", "*/*");

    // Teruskan request range (seek/lompat durasi video) dari frontend
    const range = request.headers.get("range");
    if (range) {
      fetchHeaders.set("Range", range);
    }

    const upstream = await fetch(url, {
      headers: fetchHeaders,
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `CDN Moboreels menolak akses (Status: ${upstream.status})` },
        { status: 500, headers: CORS }
      );
    }

    // Mengalirkan (Streaming) body video langsung ke response Edge
    const resHeaders = new Headers(CORS);
    resHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "video/mp4");
    
    const cl = upstream.headers.get("Content-Length");
    if (cl) resHeaders.set("Content-Length", cl);
    
    const cr = upstream.headers.get("Content-Range");
    if (cr) resHeaders.set("Content-Range", cr);
    
    const ar = upstream.headers.get("Accept-Ranges");
    if (ar) resHeaders.set("Accept-Ranges", ar);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy streaming error" },
      { status: 500, headers: CORS }
    );
  }
}

export async function HEAD(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;
    let url = q.get("url");

    if (!url && q.get("id")) {
      url = await resolveEpisode(q.get("id")!, q.get("ep") || "1", q.get("lang") || "id");
    }

    if (!url) return new NextResponse(null, { status: 400, headers: CORS });

    const fetchHeaders = new Headers();
    fetchHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    fetchHeaders.set("Referer", "https://www.moboreels.com/");

    const upstream = await fetch(url, { method: "HEAD", headers: fetchHeaders, redirect: "follow" });
    const resHeaders = new Headers(CORS);
    resHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "video/mp4");
    
    const cl = upstream.headers.get("Content-Length");
    if (cl) resHeaders.set("Content-Length", cl);
    
    const ar = upstream.headers.get("Accept-Ranges");
    if (ar) resHeaders.set("Accept-Ranges", ar);

    return new NextResponse(null, { status: upstream.status, headers: resHeaders });
  } catch {
    return new NextResponse(null, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
