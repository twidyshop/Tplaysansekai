import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BASE = "https://api.quickplay.my.id";

const ALLOWED_PATHS = new Set([
  "/api/v2/discover",
  "/api/v2/search",
  "/api/v2/detail",
  "/api/v2/video",
  "/api/v2/home",
  "/api/v2/banner",
  "/api/v2/categories",
]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const path = searchParams.get("path");

    if (!path || !ALLOWED_PATHS.has(path)) {
      return NextResponse.json(
        { success: false, error: "Invalid API path: " + path },
        { status: 400 }
      );
    }

    const upstream = new URL(BASE + path);

    // Forward all query parameters except our internal `path`.
    for (const [key, value] of searchParams.entries()) {
      if (key !== "path") upstream.searchParams.set(key, value);
    }

    // QuickPlay requires category_p for platform-specific v2 endpoints.
    // MeloShort's platform identifier is `meloshort`.
    if (!upstream.searchParams.has("category_p")) {
      upstream.searchParams.set("category_p", "meloshort");
    }

    if (!upstream.searchParams.has("lang")) {
      upstream.searchParams.set("lang", "id");
    }

    const key = process.env.QUICKPLAY_API_KEY;

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          error: "QUICKPLAY_API_KEY belum dikonfigurasi di environment variables.",
        },
        { status: 500 }
      );
    }

    // IMPORTANT:
    // The signature must be generated from the FINAL upstream path + query,
    // including category_p and lang.
    const timestamp = Date.now().toString();
    const fullPath = upstream.pathname + upstream.search;

    const signature = crypto
      .createHmac("sha256", key)
      .update(`GET:${fullPath}:${timestamp}`)
      .digest("hex");

    const response = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const text = await response.text();

    // Keep the upstream status/body so the frontend can show the real API error.
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        "Content-Type":
          response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Gagal menghubungi QuickPlay API",
      },
      { status: 500 }
    );
  }
}
