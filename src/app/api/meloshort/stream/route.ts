import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function buildProxyUrl(
  url: string,
  headers: Record<string, string>
) {
  return (
    `/api/meloshort/stream?url=` +
    `${encodeURIComponent(url)}` +
    `&headers=` +
    `${encodeURIComponent(
      JSON.stringify(headers)
    )}`
  );
}

function rewritePlaylist(
  playlist: string,
  baseUrl: string,
  headers: Record<string, string>
) {
  /*
   * Rewrite URI="..."
   *
   * Ini penting untuk:
   * - EXT-X-MEDIA
   * - EXT-X-KEY
   * - EXT-X-MAP
   * - subtitle/audio playlist
   * - variant playlist
   */
  let result = playlist.replace(
    /URI="([^"]+)"/g,
    (_match, uri) => {
      try {
        const absolute = new URL(
          uri,
          baseUrl
        ).toString();

        return `URI="${buildProxyUrl(
          absolute,
          headers
        )}"`;
      } catch {
        return `URI="${uri}"`;
      }
    }
  );

  /*
   * Rewrite URL playlist/segment
   * yang muncul sebagai baris biasa.
   */
  result = result
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith("#")) {
        return line;
      }

      try {
        const absolute =
          new URL(
            trimmed,
            baseUrl
          ).toString();

        return buildProxyUrl(
          absolute,
          headers
        );
      } catch {
        return line;
      }
    })
    .join("\n");

  return result;
}

function isSubtitleResponse(
  contentType: string,
  streamUrl: string,
  subtitleParam: string | null
) {
  const type =
    contentType.toLowerCase();

  const url =
    streamUrl.toLowerCase();

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

  /*
   * SRT:
   * 00:00:01,000 --> 00:00:03,000
   *
   * VTT:
   * 00:00:01.000 --> 00:00:03.000
   */
  text = text.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2"
  );

  return `WEBVTT\n\n${text}\n`;
}

export async function GET(
  req: NextRequest
) {
  try {
    const { searchParams } =
      new URL(req.url);

    const streamUrl =
      searchParams.get("url");

    const headersRaw =
      searchParams.get("headers");

    const subtitleParam =
      searchParams.get("subtitle");

    if (!streamUrl) {
      return new Response(
        "Missing stream URL",
        {
          status: 400,
        }
      );
    }

    /*
     * Header dasar.
     */
    const headers: Record<
      string,
      string
    > = {
      Accept: "*/*",

      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",

      Referer:
        "https://api.meloshort.com/",
    };

    /*
     * Header dari API.
     */
    if (headersRaw) {
      try {
        const parsed =
          JSON.parse(headersRaw);

        if (
          parsed &&
          typeof parsed ===
            "object" &&
          !Array.isArray(parsed)
        ) {
          for (const [
            key,
            value,
          ] of Object.entries(
            parsed
          )) {
            if (
              typeof value ===
              "string"
            ) {
              headers[key] =
                value;
            }
          }
        }
      } catch {}
    }

    /*
     * Range untuk MP4/segment.
     */
    const range =
      req.headers.get("range");

    if (range) {
      headers.Range = range;
    }

    console.log(
      "MELOSHORT PROXY:",
      streamUrl
    );

    const upstream =
      await fetch(streamUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

    if (!upstream.ok) {
      console.error(
        "UPSTREAM STATUS:",
        upstream.status,
        streamUrl
      );

      return new Response(
        `Stream upstream error: ${upstream.status}`,
        {
          status:
            upstream.status,
        }
      );
    }

    const contentType =
      upstream.headers.get(
        "content-type"
      ) || "";

    /*
     * =========================================
     * SUBTITLE
     * =========================================
     */
    if (
      isSubtitleResponse(
        contentType,
        streamUrl,
        subtitleParam
      )
    ) {
      const text =
        await upstream.text();

      const isSrt =
        contentType
          .toLowerCase()
          .includes("subrip") ||
        streamUrl
          .toLowerCase()
          .includes(".srt");

      const subtitleText =
        isSrt
          ? srtToVtt(text)
          : text;

      return new Response(
        subtitleText,
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/vtt; charset=utf-8",

            "Cache-Control":
              "no-store, no-cache, must-revalidate",

            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Headers":
              "*",

            "Access-Control-Allow-Methods":
              "GET, HEAD, OPTIONS",
          },
        }
      );
    }

    /*
     * =========================================
     * HLS
     * =========================================
     */
    const lowerType =
      contentType.toLowerCase();

    const lowerUrl =
      streamUrl.toLowerCase();

    const isHls =
      lowerType.includes(
        "mpegurl"
      ) ||
      lowerType.includes("m3u8") ||
      lowerUrl.includes(".m3u8");

    if (isHls) {
      const playlist =
        await upstream.text();

      const rewritten =
        rewritePlaylist(
          playlist,
          streamUrl,
          headers
        );

      return new Response(
        rewritten,
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/vnd.apple.mpegurl",

            "Cache-Control":
              "no-store, no-cache, must-revalidate",

            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Headers":
              "*",

            "Access-Control-Allow-Methods":
              "GET, HEAD, OPTIONS",
          },
        }
      );
    }

    /*
     * =========================================
     * VIDEO / SEGMENT / FILE
     * =========================================
     */
    const responseHeaders =
      new Headers();

    responseHeaders.set(
      "Content-Type",
      contentType ||
        "application/octet-stream"
    );

    responseHeaders.set(
      "Cache-Control",
      "no-store"
    );

    responseHeaders.set(
      "Access-Control-Allow-Origin",
      "*"
    );

    responseHeaders.set(
      "Access-Control-Allow-Headers",
      "*"
    );

    responseHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, HEAD, OPTIONS"
    );

    const contentLength =
      upstream.headers.get(
        "content-length"
      );

    if (contentLength) {
      responseHeaders.set(
        "Content-Length",
        contentLength
      );
    }

    const contentRange =
      upstream.headers.get(
        "content-range"
      );

    if (contentRange) {
      responseHeaders.set(
        "Content-Range",
        contentRange
      );
    }

    const acceptRanges =
      upstream.headers.get(
        "accept-ranges"
      );

    responseHeaders.set(
      "Accept-Ranges",
      acceptRanges || "bytes"
    );

    return new Response(
      upstream.body,
      {
        status:
          upstream.status,
        headers:
          responseHeaders,
      }
    );
  } catch (error: any) {
    console.error(
      "MELOSHORT STREAM PROXY ERROR:",
      error
    );

    return new Response(
      error?.message ||
        "Gagal mengambil stream",
      {
        status: 500,
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,

    headers: {
      "Access-Control-Allow-Origin":
        "*",

      "Access-Control-Allow-Headers":
        "*",

      "Access-Control-Allow-Methods":
        "GET, HEAD, OPTIONS",
    },
  });
}
