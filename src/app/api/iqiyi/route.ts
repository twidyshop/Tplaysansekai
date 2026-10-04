import { NextResponse } from "next/server";

export const revalidate = 600;

const BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const ACTIONS = new Set(["home", "search", "detail", "episodes", "play", "categories", "tags", "drama", "anime"]);

function makeUrl(path: string, params: Record<string, string | undefined>) {
  const u = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u;
}

function cacheHeaders(action: string) {
  if (action === "play") return { "Cache-Control": "no-store" };
  return {
    "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
  };
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const action = p.get("action") || "";

  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "Invalid IQIYI action" }, { status: 400 });
  }

  const key = process.env.HOSHIYOMI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "HOSHIYOMI_API_KEY belum dikonfigurasi di Vercel." },
      { status: 500 }
    );
  }

  const id = p.get("id") || "";
  const albumId = p.get("albumId") || undefined;
  const lang = "id";
  let target: URL;

  switch (action) {
    case "home":
      target = makeUrl("/api/iqiyi/trending", { lang });
      break;
    case "categories":
      target = makeUrl("/api/iqiyi/categories", { lang });
      break;
    case "tags":
      target = makeUrl("/api/iqiyi/tags", { cid: p.get("cid") || undefined, lang });
      break;
    case "drama":
      target = makeUrl("/api/iqiyi/drama", {
        page: p.get("page") || "1",
        region: p.get("region") || undefined,
        sort: p.get("sort") || undefined,
        genre: p.get("genre") || undefined,
        year: p.get("year") || undefined,
        sub: p.get("sub") || undefined,
        lang,
      });
      break;
    case "anime":
      target = makeUrl("/api/iqiyi/anime", {
        page: p.get("page") || "1",
        region: p.get("region") || undefined,
        sort: p.get("sort") || undefined,
        genre: p.get("genre") || undefined,
        lang,
      });
      break;
    case "search": {
      const q = p.get("query") || p.get("q") || "";
      if (!q) return NextResponse.json({ error: "Parameter query wajib diisi." }, { status: 400 });
      target = makeUrl("/api/iqiyi/search", { q, lang });
      break;
    }
    case "detail":
      if (!id) return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
      target = makeUrl("/api/iqiyi/detail", { id, albumId, lang });
      break;
    case "episodes":
      if (!id) return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
      target = makeUrl("/api/iqiyi/allepisode", { id, albumId, lang });
      break;
    case "play":
      if (!id) return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
      target = makeUrl("/api/iqiyi/episode", {
        id,
        ep: p.get("ep") || p.get("episode") || "1",
        albumId,
        lang,
      });
      break;
    default:
      return NextResponse.json({ error: "Invalid IQIYI action" }, { status: 400 });
  }

  const isPlay = action === "play";
  const controller = new AbortController();
  const timeoutMs = action === "play" ? 60000 : action === "episodes" ? 45000 : 20000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {

    const response = await fetch(target.toString(), {
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
        "User-Agent": "TPLAY+/1.0",
      },
      ...(isPlay ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const raw = await response.text();
    let data: any;

    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Hoshiyomi mengembalikan response non-JSON.", status: response.status },
        { status: response.ok ? 502 : response.status, headers: cacheHeaders(action) }
      );
    }

    if (!response.ok || data?.success === false || data?.error) {
      if (action === "detail") {
        return NextResponse.json(
          {
            success: false,
            data: {},
            error: data?.message || data?.error || "Detail sementara tidak tersedia",
            action,
          },
          { status: 200, headers: cacheHeaders(action) }
        );
      }

      return NextResponse.json(
        { error: data?.message || data?.error || "Hoshiyomi request failed", status: response.status, action },
        { status: response.status, headers: cacheHeaders(action) }
      );
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: cacheHeaders(action),
    });
  } catch (error) {
    if (action === "detail") {
      return NextResponse.json(
        {
          success: false,
          data: {},
          error: "Detail iQIYI sedang diperkaya di background.",
          action,
        },
        { status: 200, headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error && error.name === "AbortError"
        ? `Request iQIYI timeout setelah ${timeoutMs / 1000} detik.`
        : error instanceof Error ? error.message : "Hoshiyomi request failed", action },
      { status: 502, headers: cacheHeaders(action) }
    );
  }
}
