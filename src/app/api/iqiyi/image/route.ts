import { NextResponse } from "next/server";

export const runtime = "edge";
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
    `https://wsrv.nl/?url=${encodeURIComponent(sourceUrl)}&output=jpg&q=88&w=800`,
    `https://images.weserv.nl/?url=${encodeURIComponent(sourceUrl)}&output=jpg&q=88&w=800`,
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
      Origin: "https://www.iq.com",
      Accept: "image/jpeg,image/png,image/webp,image/avif,image/*,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    };

    let upstream = await fetch(url.toString(), {
      headers: fetchHeaders,
      redirect: "follow",
      cache: "no-store",
    });

    // If iQIYI returns HTML/403/etc. instead of an actual image, do not pass
    // that response to Safari as an <img>. Use an image conversion proxy.
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

    const headers = new Headers(cors());
    headers.set("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    headers.set(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800"
    );

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal mengambil gambar.",
      },
      { status: 502, headers: cors() }
    );
  }
}
