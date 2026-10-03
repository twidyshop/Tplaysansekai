import { NextResponse } from "next/server";

const HOSHIYOMI_API =
  process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";

const ACTIONS = new Set(["home", "search", "detail", "episodes", "play"]);

function apiUrl(path: string, params: Record<string, string | undefined>) {
  const url = new URL(path, HOSHIYOMI_API);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function isUsableJson(data: any) {
  return !!data && typeof data === "object" && data.success !== false && !data.error;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "";

  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "Invalid IQIYI action" }, { status: 400 });
  }

  const apiKey = process.env.HOSHIYOMI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "HOSHIYOMI_API_KEY belum dikonfigurasi di environment Vercel." },
      { status: 500 }
    );
  }

  const id = searchParams.get("id") || "";
  const albumId = searchParams.get("albumId") || "";
  const query = searchParams.get("query") || searchParams.get("q") || "";
  const ep = searchParams.get("ep") || searchParams.get("episode") || "1";
  const lang = searchParams.get("lang") || "id";

  let target: URL;

  switch (action) {
    case "home":
      target = apiUrl("/api/iqiyi/trending", { lang });
      break;
    case "search":
      if (!query) {
        return NextResponse.json({ error: "Parameter query wajib diisi." }, { status: 400 });
      }
      target = apiUrl("/api/iqiyi/search", { q: query, lang });
      break;
    case "detail":
      if (!id) {
        return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
      }
      target = apiUrl("/api/iqiyi/detail", { id, albumId: albumId || undefined, lang });
      break;
    case "episodes":
      if (!id) {
        return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
      }
      target = apiUrl("/api/iqiyi/allepisode", { id, albumId: albumId || undefined, lang });
      break;
    case "play":
      if (!id) {
        return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
      }
      target = apiUrl("/api/iqiyi/episode", {
        id,
        ep,
        albumId: albumId || undefined,
        lang,
      });
      break;
    default:
      return NextResponse.json({ error: "Invalid IQIYI action" }, { status: 400 });
  }

  try {
    const response = await fetch(target.toString(), {
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
        "User-Agent": "TPLAY+/1.0",
      },
      cache: "no-store",
    });

    const raw = await response.text();
    let data: any;

    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Hoshiyomi mengembalikan response non-JSON.", status: response.status },
        { status: response.ok ? 502 : response.status }
      );
    }

    if (!response.ok || !isUsableJson(data)) {
      return NextResponse.json(
        {
          error: data?.message || data?.error || "Hoshiyomi request failed",
          status: response.status,
          action,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hoshiyomi request failed", action },
      { status: 502 }
    );
  }
}
