import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Origin, Accept, Content-Type",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

function isImageResponse(response: Response) {
  const type = (response.headers.get("content-type") || "").toLowerCase();
  return response.ok && type.startsWith("image/");
}

async function fetchFallbackImage(sourceUrl: string) {
  const fallbackUrls = [
    `https://wsrv.nl/?url=${encodeURIComponent(sourceUrl)}&output=jpg&q=88&w=1200`,
    `https://images.weserv.nl/?url=${encodeURIComponent(sourceUrl)}&output=jpg&q=88&w=1200`,
  ];

  for (const fallbackUrl of fallbackUrls) {
    try {
      const response = await fetch(fallbackUrl, {
        headers: {
          Accept: "image/jpeg,image/*;q=0.8",
          "User-Agent": "Mozilla/5.0",
        },
        redirect: "follow",
        cache: "no-store",
      });

      if (isImageResponse(response)) return response;
    } catch {
      // Try the next image proxy.
    }
  }

  return null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url");

  if (!target) {
    return NextResponse.json(
      { error: "Parameter url wajib diisi." },
      { status: 400, headers: cors() }
    );
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return NextResponse.json(
      { error: "URL gambar tidak valid." },
      { status: 400, headers: cors() }
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return NextResponse.json(
      { error: "Protocol gambar tidak diizinkan." },
      { status: 400, headers: cors() }
    );
  }

  try {
    const fetchHeaders = {
      Referer: "https://www.iq.com/",
      Accept: "image/jpeg,image/png,image/webp,image/avif,image/*,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };

    let upstream = await fetch(url.toString(), {
      headers: fetchHeaders,
      redirect: "follow",
      cache: "no-store",
    });

    if (!isImageResponse(upstream)) {
      const fallback = await fetchFallbackImage(url.toString());

      if (!fallback) {
        return new NextResponse("Image upstream failed", {
          status: upstream.status || 502,
          headers: cors(),
        });
      }

      upstream = fallback;
    }

    const input = Buffer.from(await upstream.arrayBuffer());

    if (!input.length) {
      return new NextResponse("Empty image response", {
        status: 502,
        headers: cors(),
      });
    }

    // Decode whatever iQIYI/proxy returned and re-encode it as a real
    // baseline JPEG. Safari/iOS receives only image/jpeg bytes from this
    // endpoint, regardless of the original WebP/AVIF/PNG format.
    const jpeg = await sharp(input)
      .rotate()
      .flatten({ background: "#ffffff" })
      .jpeg({
        quality: 88,
        progressive: false,
        mozjpeg: true,
      })
      .toBuffer();

    if (!jpeg.length) {
      return new NextResponse("JPEG conversion failed", {
        status: 502,
        headers: cors(),
      });
    }

    const headers = new Headers(cors());
    headers.set("Content-Type", "image/jpeg");
    headers.set("Content-Length", String(jpeg.byteLength));
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800"
    );

    return new NextResponse(jpeg, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[iQIYI image proxy]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal mengambil gambar.",
      },
      { status: 502, headers: cors() }
    );
  }
}
