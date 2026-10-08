import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "*/*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36",
  Referer: "https://api.meloshort.com/",
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  };
}

function buildProxyUrl(url: string, headers: Record<string, string> = {}) {
  const safeHeaders = { ...headers };
  delete safeHeaders.Range;
  delete safeHeaders.range;

  return (
    `/api/meloshort/stream?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(
      JSON.stringify(safeHeaders)
    )}`
  );
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function resolveUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function rewritePlaylist(
  playlist: string,
  baseUrl: string,
  headers: Record<string, string>
) {
  let output = playlist.replace(
    /URI="([^"]+)"/gi,
    (_match, uri: string) => {
      const absolute = resolveUrl(uri, baseUrl);

      if (!isAbsoluteUrl(absolute)) {
        return `URI="${uri}"`;
      }

      return `URI="${buildProxyUrl(absolute, headers)}"`;
    }
  );

  output = output
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return line;
      }

      const absolute = resolveUrl(trimmed, baseUrl);

      if (!isAbsoluteUrl(absolute)) {
        return line;
      }

      return buildProxyUrl(absolute, headers);
    })
    .join("\n");

  return output;
}

function isSubtitleResponse(
  contentType: string,
  streamUrl: string,
  subtitleParam: string | null
) {
  const type = contentType.toLowerCase();
  const url = streamUrl.toLowerCase();

  return (
    subtitleParam === "1" ||
    type.includes("text/vtt") ||
    type.includes("webvtt") ||
    type.includes("subrip") ||
    type.includes("subtitle") ||
    url.includes(".vtt") ||
    url.includes(".srt")
  );
}

function srtToVtt(srt: string) {
  let text = srt
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  text = text.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2"
  );

  return `WEBVTT\n\n${text}\n`;
}

function isHls(contentType: string, streamUrl: string) {
  const type = contentType.toLowerCase();
  const url = streamUrl.toLowerCase();

  return (
    type.includes("mpegurl") ||
    type.includes("m3u8") ||
    url.includes(".m3u8")
  );
}

function isPlaylistUrl(url: string) {
  return /\.m3u8(?:$|\?)/i.test(url);
}

function isTsSegment(url: string, contentType = "") {
  const type = contentType.toLowerCase();
  return (
    /\.ts(?:$|\?)/i.test(url) ||
    type.includes("text/vnd.trolltech.linguist")
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const streamUrl = searchParams.get("url");
    const headersRaw = searchParams.get("headers");
    const subtitleParam = searchParams.get("subtitle");

    if (!streamUrl) {
      return new Response("Missing stream URL", { status: 400 });
    }

    const upstreamHeaders: Record<string, string> = {
      ...DEFAULT_HEADERS,
    };

    if (headersRaw) {
      try {
        const parsed = JSON.parse(headersRaw);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          for (const [key, value] of Object.entries(parsed)) {
            if (
              typeof value === "string" &&
              key.toLowerCase() !== "range"
            ) {
              upstreamHeaders[key] = value;
            }
          }
        }
      } catch {
        // Ignore malformed custom headers.
      }
    }

    const range = req.headers.get("range");
    const probablyPlaylist = isPlaylistUrl(streamUrl);

    if (range && !probablyPlaylist) {
      upstreamHeaders.Range = range;
    } else {
      delete upstreamHeaders.Range;
      delete upstreamHeaders.range;
    }

    console.log("[MELOSHORT PROXY]", streamUrl);

    const upstream = await fetch(streamUrl, {
      method: "GET",
      headers: upstreamHeaders,
      cache: "no-store",
      redirect: "follow",
    });

    const contentType = upstream.headers.get("content-type") || "";

    console.log(
      "[MELOSHORT STATUS]",
      upstream.status,
      contentType,
      streamUrl
    );

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => "");

      console.error(
        "[MELOSHORT UPSTREAM ERROR]",
        upstream.status,
        errorText.slice(0, 500)
      );

      return new Response(
        `Stream upstream error: ${upstream.status}`,
        {
          status: upstream.status,
          headers: {
            ...corsHeaders(),
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (
      isSubtitleResponse(
        contentType,
        streamUrl,
        subtitleParam
      )
    ) {
      const text = await upstream.text();

      const isSrt =
        contentType.toLowerCase().includes("subrip") ||
        /\.srt(?:$|\?)/i.test(streamUrl);

      const subtitleText = isSrt ? srtToVtt(text) : text;

      return new Response(subtitleText, {
        status: 200,
        headers: {
          "Content-Type": "text/vtt; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          ...corsHeaders(),
        },
      });
    }

    if (isHls(contentType, streamUrl)) {
      const playlist = await upstream.text();

      if (!playlist.trim().startsWith("#EXTM3U")) {
        console.error("[MELOSHORT] Invalid HLS playlist");

        return new Response(playlist, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            ...corsHeaders(),
          },
        });
      }

      const playlistHeaders = { ...upstreamHeaders };
      delete playlistHeaders.Range;
      delete playlistHeaders.range;

      const rewritten = rewritePlaylist(
        playlist,
        streamUrl,
        playlistHeaders
      );

      return new Response(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          ...corsHeaders(),
        },
      });
    }

    const responseHeaders = new Headers();

    // Shortswave's MPEG-TS segments are sometimes returned with the
    // incorrect text/vnd.trolltech.linguist MIME type. Preserve the bytes
    // and Range response, but expose the segment as MPEG-TS to hls.js.
    const responseContentType = isTsSegment(streamUrl, contentType)
      ? "video/mp2t"
      : contentType || "application/octet-stream";

    responseHeaders.set("Content-Type", responseContentType);
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set(
      "Accept-Ranges",
      upstream.headers.get("accept-ranges") || "bytes"
    );

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    const etag = upstream.headers.get("etag");
    if (etag) {
      responseHeaders.set("ETag", etag);
    }

    const lastModified = upstream.headers.get("last-modified");
    if (lastModified) {
      responseHeaders.set("Last-Modified", lastModified);
    }

    Object.entries(corsHeaders()).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("[MELOSHORT STREAM PROXY ERROR]", error);

    return new Response(
      error?.message || "Gagal mengambil stream",
      {
        status: 500,
        headers: {
          ...corsHeaders(),
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(),
    },
  });
}
