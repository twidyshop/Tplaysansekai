import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.quickplay.my.id";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    
    // Ambil path dari parameter ?path=..., default ke /api/v2/home jika kosong
    const targetPath = searchParams.get("path") || "/api/v2/home";
    const upstream = new URL(BASE + targetPath);

    // Masukkan semua parameter lain ke upstream
    for (const [k, v] of searchParams.entries()) {
      if (k !== "path") {
        upstream.searchParams.set(k, v);
      }
    }

    // Pastikan parameter wajib selalu ada
    if (!upstream.searchParams.has("category_p")) {
      upstream.searchParams.set("category_p", "meloshort");
    }
    if (!upstream.searchParams.has("lang")) {
      upstream.searchParams.set("lang", "id");
    }

    const key = process.env.QUICKPLAY_API_KEY;

    if (!key) {
      return NextResponse.json({
        success: false,
        error: "QUICKPLAY_API_KEY belum dikonfigurasi di Vercel"
      }, { status: 500 });
    }

    const ts = Date.now().toString();
    const fullPath = upstream.pathname + upstream.search;

    const signature = crypto
      .createHmac("sha256", key)
      .update(`GET:${fullPath}:${ts}`)
      .digest("hex");

    const response = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        "X-Timestamp": ts,
        "X-Signature": signature,
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
