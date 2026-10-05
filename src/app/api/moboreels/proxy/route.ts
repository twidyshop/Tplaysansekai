import { NextRequest } from "next/server";

// Menggunakan NodeJS API karena Fetch Stream di Node 18+ sangat stabil untuk file besar
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response("Missing URL parameter", { status: 400 });
  }

  try {
    const fetchHeaders = new Headers();
    // Identitas palsu agar dikira browser manusia
    fetchHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
    fetchHeaders.set("Referer", "https://www.moboreels.com/");
    fetchHeaders.set("Accept", "*/*");

    // Tangkap perintah lompat durasi (seek) dari video player
    const range = request.headers.get("range");
    if (range) fetchHeaders.set("Range", range);

    console.log("[Proxy] Mulai menyedot video dari:", url);

    // Fetch bawaan Node.js akan otomatis mengurus redirect dengan aman
    const upstream = await fetch(url, {
      headers: fetchHeaders,
      redirect: "follow",
    });

    console.log("[Proxy] Status Respon CDN:", upstream.status);

    // Jika ditolak CDN (bukan 200 OK atau 206 Partial Content)
    if (!upstream.ok && upstream.status !== 206) {
      console.error("[Proxy Error] Akses ditolak CDN dengan status:", upstream.status);
      // Return teks agar errornya bisa kamu baca langsung di browser
      return new Response(`ERROR DARI CDN MOBOREELS: Status ${upstream.status}`, { status: upstream.status });
    }

    // Siapkan Header untuk dipancarkan kembali ke frontend
    const resHeaders = new Headers();
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "video/mp4");
    resHeaders.set("Accept-Ranges", "bytes");

    for (const key of ["Content-Length", "Content-Range"]) {
      const val = upstream.headers.get(key);
      if (val) resHeaders.set(key, val);
    }

    // PIPE STREAM: Alirkan video langsung ke browser tanpa menyimpannya ke memori server
    // (Bypass limit 4.5MB Vercel)
    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });

  } catch (error: any) {
    console.error("[Proxy Fatal Error]:", error);
    return new Response(`SERVER PROXY ERROR: ${error.message}`, { status: 500 });
  }
}
