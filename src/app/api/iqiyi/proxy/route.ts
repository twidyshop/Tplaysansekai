import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const IQIYI_REFERER = "https://www.iq.com/";
const IQIYI_ORIGIN = "https://www.iq.com";

function proxyUrl(request: NextRequest, target: string) {
  return new URL(
    "/api/iqiyi/proxy?url=" + encodeURIComponent(target),
    request.url
  ).toString();
}

function rewriteManifest(manifest: string, baseUrl: URL, request: NextRequest) {
  return manifest
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      const rewrite = (raw: string) => {
        try {
          const absolute = new URL(raw, baseUrl).toString();
          return proxyUrl(request, absolute);
        } catch {
          return raw;
        }
      };

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, raw) => `URI="${rewrite(raw)}"`);
      }

      if (trimmed.startsWith("#")) return line;

      return rewrite(trimmed);
    })
    .join("\n");
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

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json(
      { error: "Parameter url wajib diisi." },
      { status: 400, headers: corsHeaders() }
    );
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return NextResponse.json(
      { error: "URL tidak valid." },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return NextResponse.json(
      { error: "Protocol URL tidak diizinkan." },
      { status: 400, headers: corsHeaders() }
    );
  }

  try {
    const range = request.headers.get("range");
    const upstreamHeaders = new Headers({
      Referer: IQIYI_REFERER,
      Origin: IQIYI_ORIGIN,
      Accept: "*/*",
      "Accept-Encoding": "identity",
      "User-Agent": request.headers.get("user-agent") ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
    });

    if (range) upstreamHeaders.set("Range", range);

    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: upstreamHeaders,
      redirect: "follow",
      cache: "no-store",
    });

    const contentType = upstream.headers.get("content-type") || "";
    const finalUrl = upstream.url || url.toString();
    const looksLikeManifest =
      contentType.includes("mpegurl") ||
      /\.m3u8(?:\?|$)/i.test(finalUrl) ||
      /\.m3u8(?:\?|$)/i.test(url.toString());

    if (looksLikeManifest) {
      const manifest = await upstream.text();

      if (!upstream.ok) {
        return new NextResponse(manifest, {
          status: upstream.status,
          headers: {
            ...corsHeaders(),
            "Content-Type": contentType || "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }

      return new NextResponse(
        rewriteManifest(manifest, new URL(finalUrl), request),
        {
          status: 200,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Stream media directly. Do NOT forward content-encoding/content-length from
    // the upstream CDN because fetch() may transparently decode the body; forwarding
    // those original headers can make Chrome/VHS wait forever for a TS segment.
    const headers = new Headers(corsHeaders());
    for (const key of [
      "content-type",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    headers.set("Cache-Control", "no-store");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil resource iQIYI.",
      },
      { status: 502, headers: corsHeaders() }
    );
  }
}
