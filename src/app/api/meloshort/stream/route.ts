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
   * Rewrite URI="..." di:
   *
   * #EXT-X-KEY
   * #EXT-X-MAP
   * #EXT-X-MEDIA
   * #EXT-X-I-FRAME-STREAM-INF
   * dll.
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
   * Rewrite URL segment / child playlist
   * yang berdiri sendiri di setiap baris.
   */
  result = result
    .split("\n")
    .map((line) => {
      const trimmed =
        line.trim();

      if (!trimmed) {
        return line;
      }

      // Jangan ubah directive HLS
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

export async function GET(
  req: NextRequest
) {
  try {
    const {
      searchParams,
    } = new URL(req.url);

    const streamUrl =
      searchParams.get("url");

    const headersRaw =
      searchParams.get(
        "headers"
      );

    if (!streamUrl) {
      return new Response(
        "Missing stream URL",
        {
          status: 400,
        }
      );
    }

    const headers: Record<
      string,
      string
    > = {
      Accept: "*/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    };

    if (headersRaw) {
      try {
        const parsed =
          JSON.parse(
            headersRaw
          );

        if (
          parsed &&
          typeof parsed ===
            "object"
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
      } catch {
        // Ignore invalid custom headers
      }
    }

    /*
     * Forward Range request.
     * Ini penting untuk MP4/video tertentu.
     */
    const range =
      req.headers.get(
        "range"
      );

    if (range) {
      headers.Range = range;
    }

    const upstream =
      await fetch(
        streamUrl,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

    if (!upstream.ok) {
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

    const isHls =
      contentType.includes(
        "mpegurl"
      ) ||
      contentType.includes(
        "m3u8"
      ) ||
      streamUrl
        .toLowerCase()
        .includes(".m3u8");

    /*
     * ======================================
     * HLS
     * ======================================
     */

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
     * ======================================
     * DIRECT VIDEO / MP4
     * ======================================
     */

    const responseHeaders =
      new Headers();

    responseHeaders.set(
      "Content-Type",
      contentType ||
        "video/mp4"
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

    if (acceptRanges) {
      responseHeaders.set(
        "Accept-Ranges",
        acceptRanges
      );
    } else {
      responseHeaders.set(
        "Accept-Ranges",
        "bytes"
      );
    }

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
  return new Response(
    null,
    {
      status: 204,
      headers: {
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
