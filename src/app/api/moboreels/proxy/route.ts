import { NextRequest, NextResponse } from "next/server";

// Konfigurasi Next.js Route
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOSHIYOMI_BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const HOSHIYOMI_KEY = process.env.HOSHIYOMI_API_KEY || "";

// Header CORS standar
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
};

// Fungsi untuk mendapatkan URL MP4 dari Hoshiyomi
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
    signal: AbortSignal.timeout(25000), // Timeout 25 detik
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

// Handler untuk metode GET
export async function GET(request: NextRequest) {
  try {
    const q = new URL(request.url).searchParams;

    let url = q.get("url");
    if (!url && q.get("id")) {
      // Ambil URL dari API Hoshiyomi jika parameter 'id' diberikan
      url = await resolveEpisode(
        q.get("id")!,
        q.get("ep") || "1",
        q.get("lang") || "id",
      );
    }

    if (!url || !/^https?:\/\//i.test(url) || !/\.mp4(?:[?#]|$)/i.test(url)) {
      return NextResponse.json(
        { error: "Missing or invalid MoboReels MP4 URL" },
        { status: 400, headers: CORS },
      );
    }

    // REDIRECT: Alihkan browser/video player langsung ke URL asli MP4-nya
    return NextResponse.redirect(url, 302);

  } catch (error) {
    console.error("[GET Redirect Error]:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "MoboReels routing failed",
      },
      { status: 500, headers: CORS },
    );
  }
}

// Handler untuk metode HEAD (digunakan oleh player video untuk mengecek metadata)
export async function HEAD(request: NextRequest) {
  try {
    const q = new URL(request.url).searchParams;
    let url = q.get("url");

    if (!url && q.get("id")) {
      url = await resolveEpisode(q.get("id")!, q.get("ep") || "1", q.get("lang") || "id");
    }

    if (!url || !/^https?:\/\//i.test(url) || !/\.mp4(?:[?#]|$)/i.test(url)) {
      return new NextResponse(null, { status: 400, headers: CORS });
    }

    // Redirect juga untuk request HEAD
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("[HEAD Redirect Error]:", error);
    return new NextResponse(null, { status: 500, headers: CORS });
  }
}

// Handler untuk metode OPTIONS (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
