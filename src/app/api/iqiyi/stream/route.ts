import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const IQIYI_REFERER = "https://www.iq.com/";
const IQIYI_ORIGIN = "https://www.iq.com";

function proxyUrl(request: Request, target: string) {
  return new URL("/api/iqiyi/proxy?url=" + encodeURIComponent(target), request.url).toString();
}

function rewriteManifest(manifest: string, baseUrl: URL, request: Request) {
  return manifest.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    const rewrite = (raw: string) => {
      try {
        return proxyUrl(request, new URL(raw, baseUrl).toString());
      } catch {
        return raw;
      }
    };

    if (trimmed.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_, raw) => `URI="${rewrite(raw)}"`);
    }

    return rewrite(trimmed);
  }).join("\n");
}

function findStream(value: any, depth = 0): string {
  if (!value || depth > 10 || typeof value !== "object") return "";
  const keys = ["hlsUrl","hls","m3u8","streamUrl","stream_url","playUrl","play_url","videoUrl","video_url","url"];
  for (const key of keys) {
    const v = value[key];
    if (typeof v === "string" && (v.startsWith("#EXTM3U") || v.includes("#EXT-X-") || /^https?:\/\//i.test(v))) return v.trim();
  }
  for (const key of Object.keys(value)) {
    const found = findStream(value[key], depth + 1);
    if (found) return found;
  }
  return "";
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Origin, Accept, Content-Type",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const id = p.get("id") || "";
  const episode = p.get("episode") || p.get("ep") || "1";
  const albumId = p.get("albumId") || "";
  const key = process.env.HOSHIYOMI_API_KEY;

  if (!id) return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400, headers: corsHeaders() });
  if (!key) return NextResponse.json({ error: "HOSHIYOMI_API_KEY belum dikonfigurasi." }, { status: 500, headers: corsHeaders() });

  const target = new URL("/api/iqiyi/episode", BASE);
  target.searchParams.set("id", id);
  target.searchParams.set("ep", episode);
  target.searchParams.set("lang", "id");
  if (albumId) target.searchParams.set("albumId", albumId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
        "User-Agent": "TPLAY+/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const raw = await upstream.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Hoshiyomi mengembalikan response non-JSON.", status: upstream.status }, { status: 502, headers: corsHeaders() });
    }

    if (!upstream.ok || data?.success === false || data?.error) {
      return NextResponse.json({ error: data?.message || data?.error || "Gagal mengambil stream iQIYI.", status: upstream.status }, { status: upstream.status || 502, headers: corsHeaders() });
    }

    const stream = findStream(data);
    if (!stream) return NextResponse.json({ error: "URL stream iQIYI tidak ditemukan." }, { status: 502, headers: corsHeaders() });

    if (stream.startsWith("#EXTM3U") || stream.includes("#EXT-X-")) {
      const baseUrl = new URL("https://data.video.iqiyi.com/");
      return new NextResponse(rewriteManifest(stream, baseUrl, request), {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const mediaUrl = new URL(stream);
    if (mediaUrl.protocol !== "https:" && mediaUrl.protocol !== "http:") {
      return NextResponse.json({ error: "Protocol stream tidak diizinkan." }, { status: 400, headers: corsHeaders() });
    }

    return NextResponse.redirect(new URL("/api/iqiyi/proxy?url=" + encodeURIComponent(mediaUrl.toString()), request.url), 307);
  } catch (error) {
    clearTimeout(timeout);
    return NextResponse.json({
      error: error instanceof Error && error.name === "AbortError"
        ? "Request stream iQIYI timeout setelah 25 detik."
        : error instanceof Error ? error.message : "Gagal mengambil stream iQIYI.",
    }, { status: 502, headers: corsHeaders() });
  }
}
