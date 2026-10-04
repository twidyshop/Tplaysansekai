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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url");
  const format = requestUrl.searchParams.get("format") || "jpg";
  if (!target) return NextResponse.json({ error: "Parameter url wajib diisi." }, { status: 400, headers: cors() });

  let url: URL;
  try { url = new URL(target); } catch {
    return NextResponse.json({ error: "URL gambar tidak valid." }, { status: 400, headers: cors() });
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return NextResponse.json({ error: "Protocol gambar tidak diizinkan." }, { status: 400, headers: cors() });
  }

  try {
    const fetchHeaders = {
      Referer: "https://www.iq.com/",
      Origin: "https://www.iq.com",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    };

    // Force a broadly compatible raster format. Safari/iOS can be picky
    // about some WebP/AVIF variants returned by image CDNs.
    if (format === "jpg" || format === "jpeg") {
      const cdn = "https://wsrv.nl/?url=" + encodeURIComponent(url.toString()) + "&output=jpg&q=88&w=800";
      const cdnResponse = await fetch(cdn, {
        headers: { Accept: "image/jpeg,image/*;q=0.8" },
        redirect: "follow",
        cache: "no-store",
      });
      if (cdnResponse.ok) {
        const headers = new Headers(cors());
        headers.set("Content-Type", "image/jpeg");
        headers.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
        return new NextResponse(cdnResponse.body, { status: 200, headers });
      }
    }

    let upstream = await fetch(url.toString(), {
      headers: fetchHeaders,
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok) {
      const fallback = "https://wsrv.nl/?url=" + encodeURIComponent(url.toString()) + "&output=jpg&q=88&w=800";
      upstream = await fetch(fallback, {
        headers: { Accept: "image/jpeg,image/*;q=0.8" },
        redirect: "follow",
        cache: "no-store",
      });
    }

    if (!upstream.ok) {
      return new NextResponse("Image upstream failed", { status: upstream.status, headers: cors() });
    }

    const headers = new Headers(cors());
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengambil gambar." }, { status: 502, headers: cors() });
  }
}
