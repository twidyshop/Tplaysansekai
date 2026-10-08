import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");

  if (!target) {
    return new NextResponse("Missing image URL", { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
        Referer: "https://www.stardust-tv.com/",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new NextResponse("Image upstream returned HTTP " + upstream.status, {
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: unknown) {
    return new NextResponse(
      error instanceof Error ? error.message : "Image proxy gagal",
      { status: 500 },
    );
  }
}
