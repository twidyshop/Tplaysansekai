import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) return NextResponse.json({ error: "Parameter url wajib diisi." }, { status: 400 });

  let url: URL;
  try { url = new URL(target); } catch {
    return NextResponse.json({ error: "URL tidak valid." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return NextResponse.json({ error: "Protocol URL tidak diizinkan." }, { status: 400 });
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Referer: "https://www.iq.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
      },
      cache: "no-store",
    });

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengambil resource iQIYI." },
      { status: 502 }
    );
  }
}
