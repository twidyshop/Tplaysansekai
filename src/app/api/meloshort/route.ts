import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.quickplay.my.id";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const path = searchParams.get("path");

    const allowed = [
      "/api/v2/discover",
      "/api/v2/search",
      "/api/v2/detail",
      "/api/v2/video",
      "/api/v2/home",
      "/api/v2/banner",
      "/api/v2/categories"
    ];

    if (!path || !allowed.includes(path)) {
      return NextResponse.json({
        success: false,
        error: "Invalid API path: " + path
      }, { status: 400 });
    }

    const upstream = new URL(BASE + path);

    for (const [k, v] of searchParams.entries()) {
      if (k !== "path") {
        upstream.searchParams.set(k, v);
      }
    }

    // Default paksa bahasa Indonesia jika belum ada
    if (!upstream.searchParams.has("lang")) {
      upstream.searchParams.set("lang", "id");
    }

    const key = process.env.QUICKPLAY_API_KEY;

    if (!key) {
      return NextResponse.json({
        success: false,
        error: "QUICKPLAY_API_KEY belum dikonfigurasi"
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

    const resHeaders = new Headers();
    resHeaders.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    resHeaders.set("Content-Type", response.headers.get("content-type") || "application/json");

    return new NextResponse(text, {
      status: response.status,
      headers: resHeaders
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
