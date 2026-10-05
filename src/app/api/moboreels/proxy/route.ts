import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function abs(base: string, v: string) {
  try {
    return new URL(v, base).toString();
  } catch {
    return v;
  }
}

function rewrite(text: string, base: string, proxy: string) {
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (
        !t ||
        t.startsWith("#EXTM3U") ||
        t.startsWith("#EXT-X-") ||
        t.startsWith("#EXTINF") ||
        t.startsWith("#EXT-X-VERSION") ||
        t.startsWith("#EXT-X-TARGETDURATION") ||
        t.startsWith("#EXT-X-MEDIA-SEQUENCE") ||
        t.startsWith("#EXT-X-ENDLIST")
      ) return line;
      if (t.startsWith("#")) {
        return line.replace(
          /URI="([^"]+)"/g,
          (_, u) => `URI="${proxy}?url=${encodeURIComponent(abs(base, u))}"`
        );
      }
      return proxy + "?url=" + encodeURIComponent(abs(base, t));
    })
    .join("\n");
}

async function fetchHoshiyomiRelay(url: string, range: string | null) {
  const apiKey = process.env.HOSHIYOMI_API_KEY;
  const base = (process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id").replace(/\/$/, "");
  if (!apiKey) return null;

  try {
    const relay = base + "/api/stream?url=" + encodeURIComponent(url);
    const headers: Record<string, string> = {
      "X-API-Key": apiKey,
      "User-Agent": "Mozilla/5.0",
      Accept: "*/*",
    };
    if (range) headers.Range = range;

    const response = await fetch(relay, {
      headers,
      cache: "no-store",
      redirect: "follow",
    });

    if (response.ok || response.status === 206) return response;
  } catch {
    // Fall through to the direct CDN attempts below.
  }

  return null;
}

async function fetchUpstream(url: string, range: string | null) {
  const referers = [
    "https://www.moboreels.com/",
    "https://moboreels.com/",
    "https://www.cdreader.com/",
    "https://cdreader.com/",
    "https://www.tplay.my.id/",
    "",
  ];

  let last: Response | null = null;

  for (const referer of referers) {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      Accept: "*/*",
      Referer: referer,
      "Sec-Fetch-Dest": "video",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site",
    };
    if (referer) {
      headers.Referer = referer;
      headers.Origin = new URL(referer).origin;
    }
    if (range) headers.Range = range;

    const response = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "follow",
    });

    last = response;
    if (response.ok || response.status === 206) return response;
  }

  return last;
}

export async function GET(r: Request) {
  const u = new URL(r.url).searchParams.get("url");
  if (!u) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const range = r.headers.get("range");
    // Prefer Hoshiyomi's relay when available so protected MoboReels/CDReader
    // URLs are authorized upstream instead of being fetched directly by Vercel.
    const relayed = await fetchHoshiyomiRelay(u, range);
    const x = relayed || (await fetchUpstream(u, range));

    if (!x) {
      return NextResponse.json({ error: "No upstream response" }, { status: 502 });
    }

    if (!x.ok && x.status !== 206) {
      return NextResponse.json(
        { error: `Upstream ${x.status}`, upstream: new URL(u).hostname },
        { status: x.status }
      );
    }

    const ct = x.headers.get("content-type") || "";

    if (ct.includes("mpegurl") || /\.m3u8($|\?)/i.test(u)) {
      const body = rewrite(
        await x.text(),
        u,
        new URL("/api/moboreels/proxy", r.url).toString()
      );
      return new NextResponse(body, {
        status: x.status,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!x.body) {
      return NextResponse.json({ error: "Empty stream" }, { status: 502 });
    }

    const headers = new Headers();
    for (const k of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ]) {
      const v = x.headers.get(k);
      if (v) headers.set(k, v);
    }
    headers.set("Cache-Control", "no-store");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Headers", "Range");
    headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");

    return new NextResponse(x.body, { status: x.status, headers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy failed" },
      { status: 502 }
    );
  }
}
