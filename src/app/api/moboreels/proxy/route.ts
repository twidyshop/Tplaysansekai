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

async function fetchViaFallbackProxy(url: string, range: string | null) {
  const candidates = [
    "https://corsproxy.io/?url=" + encodeURIComponent(url),
    "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
  ];

  for (const proxyUrl of candidates) {
    try {
      const headers: Record<string, string> = {
        Accept: "*/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      };
      if (range) headers.Range = range;

      const response = await fetch(proxyUrl, {
        headers,
        cache: "no-store",
        redirect: "follow",
      });

      if (response.ok || response.status === 206) return response;
    } catch {
      // Try the next fallback.
    }
  }

  return null;
}

async function resolveMoboReelsVideo(requestUrl: string) {
  const p = new URL(requestUrl).searchParams;
  const id = p.get("id");
  const ep = p.get("ep");
  if (!id || !ep) return "";

  const key = process.env.HOSHIYOMI_API_KEY;
  if (!key) return "";

  const base = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
  const endpoint = new URL("/api/moboreels/episode", base);
  endpoint.searchParams.set("id", id);
  endpoint.searchParams.set("ep", ep);
  endpoint.searchParams.set("lang", p.get("lang") || "id");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(endpoint, {
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://www.moboreels.com/",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return "";
    const data = await response.json();

    const findUrl = (v: any, depth = 0): string => {
      if (depth > 8 || v == null) return "";
      if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
      if (typeof v !== "object") return "";
      for (const key of [
        "videoUrl",
        "video_url",
        "playUrl",
        "play_url",
        "url",
        "streamUrl",
        "stream_url",
      ]) {
        const value = v[key];
        if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
      }
      for (const key of Object.keys(v)) {
        const found = findUrl(v[key], depth + 1);
        if (found) return found;
      }
      return "";
    };

    return findUrl(data);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(r: Request) {
  const requestUrl = new URL(r.url);
  let u = requestUrl.searchParams.get("url") || "";

  try {
    if (requestUrl.searchParams.get("id") && requestUrl.searchParams.get("ep")) {
      const fresh = await resolveMoboReelsVideo(r.url);
      if (fresh) u = fresh;
    }

    if (!u) return NextResponse.json({ error: "Missing video URL" }, { status: 400 });

    const range = r.headers.get("range");
    let x = await fetchUpstream(u, range);

    if (!x || (!x.ok && x.status !== 206)) {
      const fallback = await fetchViaFallbackProxy(u, range);
      if (fallback) x = fallback;
    }

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
