import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Origin, Accept, Content-Type",
    "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
  };
}

function isImage(response: Response) {
  return response.ok && (response.headers.get("content-type") || "").toLowerCase().startsWith("image/");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: responseHeaders() });
}

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url");

  if (!source) {
    return NextResponse.json({ error: "Parameter url wajib diisi." }, { status: 400, headers: responseHeaders() });
  }

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return NextResponse.json({ error: "URL gambar tidak valid." }, { status: 400, headers: responseHeaders() });
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return NextResponse.json({ error: "Protocol gambar tidak diizinkan." }, { status: 400, headers: responseHeaders() });
  }

  try {
    let upstream = await fetch(url.toString(), {
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/avif,image/*,*/*;q=0.8",
        Referer: "https://www.moboreels.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!isImage(upstream)) {
      for (const proxy of [
        `https://wsrv.nl/?url=${encodeURIComponent(source)}&output=jpg&q=88&w=800`,
        `https://images.weserv.nl/?url=${encodeURIComponent(source)}&output=jpg&q=88&w=800`,
      ]) {
        try {
          const response = await fetch(proxy, {
            headers: { Accept: "image/jpeg,image/*;q=0.8", "User-Agent": "Mozilla/5.0" },
            redirect: "follow",
            cache: "no-store",
          });
          if (isImage(response)) {
            upstream = response;
            break;
          }
        } catch {}
      }
    }

    if (!isImage(upstream)) {
      return new NextResponse("Image upstream failed", { status: 502, headers: responseHeaders() });
    }

    const input = Buffer.from(await upstream.arrayBuffer());
    const jpeg = await sharp(input).rotate().flatten({ background: "#ffffff" }).jpeg({
      quality: 88,
      progressive: false,
      mozjpeg: true,
    }).toBuffer();

    const headers = new Headers(responseHeaders());
    headers.set("Content-Type", "image/jpeg");
    headers.set("Content-Length", String(jpeg.byteLength));
    headers.set("X-Content-Type-Options", "nosniff");

    const body = jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength) as ArrayBuffer;
    return new NextResponse(body, { status: 200, headers });
  } catch (error) {
    console.error("[MoboReels image proxy]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengambil gambar." },
      { status: 502, headers: responseHeaders() }
    );
  }
}
