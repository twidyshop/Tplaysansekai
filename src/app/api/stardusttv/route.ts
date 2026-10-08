import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BASE_URL = "https://api.quickplay.my.id";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetPath =
      searchParams.get("path") || "/api/v2/homeDrama";

    const upstream = new URL(BASE_URL + targetPath);

    for (const [key, value] of searchParams.entries()) {
      if (key !== "path") {
        upstream.searchParams.set(key, value);
      }
    }

    upstream.searchParams.set("category_p", "stardusttv");

    if (!upstream.searchParams.has("lang")) {
      upstream.searchParams.set("lang", "id");
    }

    const apiKey = process.env.QUICKPLAY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "QUICKPLAY_API_KEY belum dikonfigurasi di Vercel",
        },
        { status: 500 },
      );
    }

    const timestamp = Date.now().toString();
    const signedPath = upstream.pathname + upstream.search;

    const signature = crypto
      .createHmac("sha256", apiKey)
      .update("GET:" + signedPath + ":" + timestamp)
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

    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "QuickPlay request gagal",
      },
      { status: 500 },
    );
  }
}
