import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 });
  }

  try {
    const fetchHeaders = new Headers();
    // Identitas palsu yang diwajibkan
    fetchHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
    fetchHeaders.set("Referer", "https://www.moboreels.com/");
    fetchHeaders.set("Accept", "*/*");

    const range = request.headers.get("range");
    if (range) fetchHeaders.set("Range", range);

    // Kirim request ke CDN
    const upstream = await fetch(url, {
      headers: fetchHeaders,
      redirect: "follow",
    });

    // MODE DEBUG: Jika URL ditambahkan ?debug=true, tampilkan laporan lengkap dari CDN
    if (request.nextUrl.searchParams.get("debug") === "true") {
      return NextResponse.json({
        laporan_diagnosa: "Analisis Koneksi ke CDN MoboReels",
        url_target: url,
        status_dari_cdn: upstream.status,
        pesan_status_cdn: upstream.statusText,
        header_dari_cdn: Object.fromEntries(upstream.headers.entries()),
      });
    }

    // Alur Normal (Streaming)
    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`DITOLAK CDN: Status HTTP ${upstream.status}`, { status: upstream.status });
    }

    const resHeaders = new Headers();
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "video/mp4");
    resHeaders.set("Accept-Ranges", "bytes");

    for (const key of ["Content-Length", "Content-Range"]) {
      const val = upstream.headers.get(key);
      if (val) resHeaders.set(key, val);
    }

    return new Response(upstream.body as any, {
      status: upstream.status,
      headers: resHeaders,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
