import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function srtToVtt(input: string): string {
  // Strip a UTF-8 BOM and normalize all line endings before converting.
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const blocks = normalized.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    // SRT blocks normally start with a numeric cue index. Keep cue text intact.
    if (lines.length > 1 && /^\s*\d+\s*$/.test(lines[0])) lines.shift();
    for (let i = 0; i < lines.length; i++) {
      lines[i] = lines[i].replace(
        /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
        "$1.$2 --> $3.$4",
      );
    }
    return lines.join("\n");
  }).filter(Boolean);

  return "WEBVTT\n\n" + blocks.join("\n\n") + "\n";
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  const requestedFormat = (request.nextUrl.searchParams.get("format") || "").toLowerCase();

  if (!target) {
    return new NextResponse("Missing video URL", { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
    if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
      return new NextResponse("Unsupported URL protocol", { status: 400 });
    }
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0",
      Accept: "*/*",
    };

    const range = request.headers.get("range");
    if (range) headers.Range = range;

    const upstream = await fetch(targetUrl.toString(), {
      headers,
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new NextResponse(
        "Upstream resource returned HTTP " + upstream.status,
        { status: upstream.status },
      );
    }

    const contentType = upstream.headers.get("content-type") || "";
    const isPlaylist =
      /mpegurl/i.test(contentType) ||
      /\.m3u8(?:$|\?)/i.test(targetUrl.pathname + targetUrl.search);

    if (isPlaylist) {
      const playlist = await upstream.text();
      const baseUrl = new URL(targetUrl);

      const proxyUrl = (value: string) => {
        try {
          const absolute = new URL(value, baseUrl).toString();
          return "/api/stardusttv/stream?url=" + encodeURIComponent(absolute);
        } catch {
          return value;
        }
      };

      const rewritten = playlist
        .split(/\r?\n/)
        .map((line) => {
          const value = line.trim();
          if (!value) return line;
          if (value.startsWith("#")) {
            return line.replace(/URI="([^"]+)"/g, (_match, uri: string) =>
              'URI="' + proxyUrl(uri) + '"',
            );
          }
          return proxyUrl(value);
        })
        .join("\n");

      return new NextResponse(rewritten, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }

    const isSrt =
      requestedFormat === "srt" ||
      /\.srt(?:$|\?)/i.test(targetUrl.pathname + targetUrl.search) ||
      /application\/(?:x-subrip|vnd\.subtitle|x-srt)/i.test(contentType);

    if (isSrt) {
      const subtitleText = await upstream.text();
      const vtt = srtToVtt(subtitleText);
      return new NextResponse(vtt, {
        headers: {
          "Content-Type": "text/vtt; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "X-Subtitle-Format": "srt-converted-to-vtt",
        },
      });
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType || "application/octet-stream");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");

    for (const header of ["content-length", "content-range", "etag", "last-modified"]) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    return new NextResponse(
      error instanceof Error ? error.message : "StardustTV proxy gagal",
      { status: 500 },
    );
  }
}
