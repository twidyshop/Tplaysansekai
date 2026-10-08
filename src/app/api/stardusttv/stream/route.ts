import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");

  if (!target) {
    return new NextResponse("Missing video URL", { status: 400 });
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0",
      Accept: "*/*",
    };

    const range = request.headers.get("range");

    if (range) {
      headers.Range = range;
    }

    const upstream = await fetch(target, {
      headers,
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new NextResponse(
        "Upstream video returned HTTP " + upstream.status,
        { status: upstream.status },
      );
    }

    const contentType = upstream.headers.get("content-type") || "";

    if (
      /mpegurl/i.test(contentType) ||
      /\.m3u8(?:$|\?)/i.test(target)
    ) {
      const playlist = await upstream.text();
      const baseUrl = new URL(target);

      const rewritten = playlist
        .split(/\r?\n/)
        .map((line) => {
          const value = line.trim();

          if (!value || value.startsWith("#")) {
            return line;
          }

          try {
            const absolute = new URL(value, baseUrl).toString();

            return (
              "/api/stardusttv/stream?url=" +
              encodeURIComponent(absolute)
            );
          } catch {
            return line;
          }
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

    const responseHeaders = new Headers();

    responseHeaders.set(
      "Content-Type",
      contentType || "application/octet-stream",
    );
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set(
      "Accept-Ranges",
      upstream.headers.get("accept-ranges") || "bytes",
    );

    for (const header of [
      "content-length",
      "content-range",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(header);

      if (value) {
        responseHeaders.set(header, value);
      }
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    return new NextResponse(
      error instanceof Error ? error.message : "Video proxy gagal",
      { status: 500 },
    );
  }
}
