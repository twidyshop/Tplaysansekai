import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const streamUrl = searchParams.get("url");
    const headersRaw = searchParams.get("headers");

    if (!streamUrl) {
      return new Response("Missing stream URL", { status: 400 });
    }

    const headers: Record<string, string> = {
      Accept: "*/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    };

    if (headersRaw) {
      try {
        const parsed = JSON.parse(headersRaw);

        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === "string") {
            headers[key] = value;
          }
        }
      } catch {
        // abaikan jika headers bukan JSON valid
      }
    }

    const upstream = await fetch(streamUrl, {
      headers,
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new Response(
        `Stream upstream error: ${upstream.status}`,
        { status: upstream.status }
      );
    }

    const contentType =
      upstream.headers.get("content-type") ||
      (streamUrl.includes(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : "video/mp4");

    /*
     * Untuk playlist HLS, rewrite URL segment supaya
     * browser juga mengambil segment melalui proxy kita.
     */
    if (
      contentType.includes("mpegurl") ||
      streamUrl.includes(".m3u8")
    ) {
      const playlist = await upstream.text();

      const baseUrl = new URL(streamUrl);

      const rewritten = playlist
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();

          if (
            !trimmed ||
            trimmed.startsWith("#")
          ) {
            return line;
          }

          try {
            const absolute = new URL(trimmed, baseUrl).toString();

            const encodedHeaders = encodeURIComponent(
              JSON.stringify(headers)
            );

            return `/api/meloshort/stream?url=${encodeURIComponent(
              absolute
            )}&headers=${encodedHeaders}`;
          } catch {
            return line;
          }
        })
        .join("\n");

      return new Response(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    /*
     * Untuk MP4 / file video biasa.
     */
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        ...(upstream.headers.get("content-length")
          ? {
              "Content-Length":
                upstream.headers.get("content-length")!,
            }
          : {}),
      },
    });
  } catch (error: any) {
    return new Response(
      error?.message || "Gagal mengambil stream",
      { status: 500 }
    );
  }
}
