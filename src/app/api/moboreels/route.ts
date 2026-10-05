import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE =
  process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";

const ACTIONS = new Set([
  "home",
  "trending",
  "foryou",
  "languages",
  "search",
  "detail",
  "play",
]);

function target(action: string, p: URLSearchParams) {
  const name = action === "home" ? "trending" : action === "play" ? "episode" : action;
  const u = new URL("/api/moboreels/" + name, BASE);

  if (action === "foryou") {
    u.searchParams.set("page", p.get("page") || "1");
    u.searchParams.set("lang", p.get("lang") || "id");
  } else if (action === "trending" || action === "home") {
    u.searchParams.set("lang", p.get("lang") || "id");
  } else if (action === "search") {
    u.searchParams.set("q", p.get("q") || p.get("query") || "");
    u.searchParams.set("lang", p.get("lang") || "id");
  } else if (action === "detail") {
    u.searchParams.set("id", p.get("id") || "");
    u.searchParams.set("lang", p.get("lang") || "id");
  } else if (action === "play") {
    u.searchParams.set("id", p.get("id") || "");
    u.searchParams.set("ep", p.get("ep") || p.get("episode") || "");
    u.searchParams.set("lang", p.get("lang") || "id");
  }

  return u;
}

function pick(v: any, keys: string[]) {
  if (!v || typeof v !== "object") return "";
  for (const key of keys) {
    const x = v[key];
    if (typeof x === "string" && x.trim()) return x.trim();
    if (typeof x === "number") return String(x);
  }
  return "";
}

function deepPick(v: any, keys: string[], depth = 0): string {
  if (depth > 8 || v == null) return "";
  const direct = pick(v, keys);
  if (direct) return direct;
  if (typeof v !== "object") return "";
  for (const key of Object.keys(v)) {
    const found = deepPick(v[key], keys, depth + 1);
    if (found) return found;
  }
  return "";
}

function findArray(v: any, depth = 0): any[] {
  if (depth > 8 || v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v !== "object") return [];

  for (const key of [
    "items",
    "data",
    "list",
    "rows",
    "results",
    "records",
    "contents",
    "dramas",
    "albums",
    "books",
  ]) {
    const found = findArray(v[key], depth + 1);
    if (found.length) return found;
  }
  return [];
}

function normalizeItems(data: any) {
  return findArray(data).map((item: any, index: number) => ({
    id:
      deepPick(item, [
        "id",
        "dramaId",
        "drama_id",
        "bookId",
        "videoId",
        "albumId",
        "key",
      ]) || String(index),
    title:
      deepPick(item, [
        "title",
        "name",
        "bookName",
        "book_name",
        "albumName",
        "dramaName",
      ]) || "Untitled",
    cover: deepPick(item, [
      "cover",
      "coverUrl",
      "cover_url",
      "coverImage",
      "cover_image",
      "coverImg",
      "verticalCover",
      "vertical_cover",
      "poster",
      "posterUrl",
      "poster_url",
      "posterImage",
      "poster_image",
      "posterImg",
      "posterImgUrl",
      "image",
      "imageUrl",
      "image_url",
      "thumbnail",
      "thumbnailUrl",
      "thumbnail_url",
      "thumbUrl",
      "thumb_url",
      "pic",
      "picUrl",
      "pic_url",
      "img",
      "imgUrl",
      "img_url",
    ]),
    episodes:
      Number(
        deepPick(item, [
          "totalEpisodes",
          "episodeCount",
          "episode_count",
          "serialCount",
          "serial_count",
          "episodes",
        ])
      ) || 0,
  }));
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const action = p.get("action") || "";

  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "Invalid MoboReels action" }, { status: 400 });
  }

  const key = process.env.HOSHIYOMI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "HOSHIYOMI_API_KEY belum dikonfigurasi di Vercel." },
      { status: 500 }
    );
  }

  if (["detail", "play"].includes(action) && !p.get("id")) {
    return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
  }

  if (action === "search" && !(p.get("q") || p.get("query"))) {
    return NextResponse.json({ error: "Parameter q wajib diisi." }, { status: 400 });
  }

  const url = target(action, p);
  const ms = action === "play" ? 25000 : 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    console.log("[MoboReels]", action, "->", url.pathname + url.search);

    const response = await fetch(url, {
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://www.moboreels.com/",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    clearTimeout(timeout);

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Hoshiyomi mengembalikan response non-JSON." },
        { status: 502 }
      );
    }

    if (
      !response.ok ||
      (data && typeof data === "object" &&
        ((data.success === false) || data.error))
    ) {
      return NextResponse.json(
        {
          error:
            (typeof data?.message === "string" && data.message) ||
            (typeof data?.error === "string" && data.error) ||
            "Hoshiyomi request failed",
          status: response.status,
          action,
        },
        { status: response.status }
      );
    }

    if (["home", "trending", "foryou", "search"].includes(action)) {
      const items = normalizeItems(data);
      return NextResponse.json(
        {
          ...data,
          items,
          data: items,
          _moboreels: { normalized: true, count: items.length, action },
        },
        {
          status: response.status,
          headers: {
            "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
          },
        }
      );
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Cache-Control":
          action === "play"
            ? "no-store"
            : "public, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "AbortError"
            ? `Request MoboReels timeout setelah ${ms / 1000} detik.`
            : error instanceof Error
              ? error.message
              : "Hoshiyomi request failed",
        action,
      },
      { status: 502 }
    );
  }
}
