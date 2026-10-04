import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(r: Request) {
  const src = new URL(r.url).searchParams.get("url");

  if (!src) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const x = await fetch(src, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept":
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!x.ok) throw new Error("Direct image fetch failed");

    const out = await sharp(Buffer.from(await x.arrayBuffer()))
      .jpeg({ quality: 88 })
      .toBuffer();

    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    try {
      const x = await fetch(
        "https://wsrv.nl/?url=" + encodeURIComponent(src),
        { cache: "no-store" }
      );

      if (!x.ok) throw new Error("Fallback image fetch failed");

      const out = await sharp(Buffer.from(await x.arrayBuffer()))
        .jpeg({ quality: 88 })
        .toBuffer();

      return new NextResponse(new Uint8Array(out), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400, s-maxage=604800",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Image proxy failed" },
        { status: 502 }
      );
    }
  }
}
