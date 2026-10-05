import { NextRequest, NextResponse } from "next/server";

// KUNCI 1: Gunakan Edge agar kuat streaming video tanpa batas RAM 4.5MB Vercel
export const runtime = "edge";

const HOSHIYOMI_BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const HOSHIYOMI_KEY = process.env.HOSHIYOMI_API_KEY || "";

async function resolveEpisode(id: string, ep: string, lang: string) {
  const u = new URL("/api/moboreels/episode", HOSHIYOMI_BASE);
  u.searchParams.set("id", id);
  u.searchParams.set("ep", ep);
  u.searchParams.set("lang", lang);

  const r = await fetch(u.toString(), {
    headers: {
      Accept: "application/json",
      ...(HOSHIYOMI_KEY ? { "X-API-Key": HOSHIYOMI_KEY } : {}),
    },
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`Hoshiyomi API Error: ${r.status}`);

  const data = (await r.json()) as { videoUrl?: unknown };
  if (typeof data.videoUrl !== "string") {
    throw new Error("MoboReels episode did not return a valid videoUrl");
  }

  return data.videoUrl;
}

// Fungsi fetch khusus untuk mengakali CDN yang suka membuang header saat Redirect
async function fetchVideo(url: string, range: string | null) {
  let currentUrl = url;

  const headers = new Headers({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.moboreels.com/", // WAJIB ADA untuk lolos 403
    "Accept": "*/*",
  });

  if (range) headers.set("Range", range);

  // KUNCI 2: Manual Loop Redirect maksimal 3 kali agar Header Referer dipertahankan
  for (let i = 0; i < 3; i++) {
    const response = await fetch(currentUrl, {
      headers,
      redirect: "manual", // Mencegah Vercel/Node membuang header otomatis
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        // Tangkap URL tujuan baru, dan ulangi fetch dengan membawa Referer utuh
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }
    }

    return response;
  }

  throw new Error("Terlalu banyak redirect dari CDN MoboReels");
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;
    let url = q.get("url");

    if (!url && q.get("id")) {
      url = await resolveEpisode(q.get("id")!, q.get("ep") || "1", q.get("lang") || "id");
    }

    if (!url) return NextResponse.json({ error: "Missing URL" }, { status: 400 });

    const range = request.headers.get("range");
    const upstream = await fetchVideo(url, range);

    if (!upstream.ok && upstream.status !== 206) {
      console.error("[Proxy Error] Status:", upstream.status, "URL:", url);
      return NextResponse.json(
        { error: `Akses ditolak CDN MoboReels (Status: ${upstream.status})` },
        { status: 500 }
      );
    }

    const resHeaders = new Headers();
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "video/mp4");
    
    // KUNCI 3: Beritahu player video agar melakukan chunking/mencicil unduhan
    // Ini krusial agar fungsi Edge Vercel tidak terkena timeout saat memutar video durasi panjang
    resHeaders.set("Accept-Ranges", "bytes");

    for (const key of ["Content-Length", "Content-Range", "Cache-Control", "ETag", "Last-Modified"]) {
      const val = upstream.headers.get(key);
      if (val) resHeaders.set(key, val);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });

  } catch (error: any) {
    console.error("[GET Proxy Error]:", error);
    return NextResponse.json(
      { error: error.message || "Proxy streaming error" },
      { status: 500 }
    );
  }
}

export async function HEAD(request: NextRequest) {
  // Pemutar video kadang melempar HTTP HEAD sebelum memutar video untuk mengecek ukuran
  try {
    const q = request.nextUrl.searchParams;
    let url = q.get("url");

    if (!url && q.get("id")) {
      url = await resolveEpisode(q.get("id")!, q.get("ep") || "1", q.get("lang") || "id");
    }

    if (!url) return new NextResponse(null, { status: 400 });

    const upstream = await fetchVideo(url, request.headers.get("range"));
    const resHeaders = new Headers();
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "video/mp4");
    resHeaders.set("Accept-Ranges", "bytes");

    for (const key of ["Content-Length", "Content-Range", "Cache-Control"]) {
      const val = upstream.headers.get(key);
      if (val) resHeaders.set(key, val);
    }

    return new NextResponse(null, { status: upstream.status, headers: resHeaders });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

export async function OPTIONS() {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, Content-Type");
  return new NextResponse(null, { status: 204, headers });
}
