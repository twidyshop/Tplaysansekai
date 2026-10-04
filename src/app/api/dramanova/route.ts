import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 600;

const BASE =
  process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";

const ACTIONS = new Set([
  "home",
  "trending",
  "foryou",
  "latest",
  "languages",
  "search",
  "detail",
  "play",
]);

function target(action: string, p: URLSearchParams) {
  const name = action === "home" ? "trending" : action === "play" ? "episode" : action;
  const u = new URL("/api/dramanova/" + name, BASE);

  if (action === "foryou") {
    u.searchParams.set("page", p.get("page") || "1");
    u.searchParams.set("lang", p.get("lang") || "id");
  } else if (action === "trending" || action === "latest" || action === "home") {
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

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const action = p.get("action") || "";

  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { error: "Invalid DramaNova action" },
      { status: 400 }
    );
  }

  const key = process.env.HOSHIYOMI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "HOSHIYOMI_API_KEY belum dikonfigurasi di Vercel." },
      { status: 500 }
    );
  }

  if (["detail", "play"].includes(action) && !p.get("id")) {
    return NextResponse.json(
      { error: "Parameter id wajib diisi." },
      { status: 400 }
    );
  }

  if (action === "play" && !(p.get("ep") || p.get("episode"))) {
    return NextResponse.json(
      { error: "Parameter ep wajib diisi." },
      { status: 400 }
    );
  }

  if (action === "search" && !(p.get("q") || p.get("query"))) {
    return NextResponse.json(
      { error: "Parameter q wajib diisi." },
      { status: 400 }
    );
  }

  const url = target(action, p);
  const ms = action === "play" ? 25000 : 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    console.log(
      `[DramaNova] ${action} -> ${url.pathname}${url.search}`
    );

    const response = await fetch(url, {
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
        "User-Agent": "TPLAY+/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    clearTimeout(timeout);

    console.log(
      `[DramaNova] ${action} <- ${response.status} (${raw.length} bytes)`
    );

    let data: unknown;
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
      (typeof data === "object" &&
        data !== null &&
        ("success" in data && data.success === false ||
          "error" in data && data.error))
    ) {
      const obj = data as Record<string, unknown>;
      return NextResponse.json(
        {
          error:
            (typeof obj.message === "string" && obj.message) ||
            (typeof obj.error === "string" && obj.error) ||
            "Hoshiyomi request failed",
          status: response.status,
          action,
        },
        { status: response.status }
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
            ? `Request DramaNova timeout setelah ${ms / 1000} detik.`
            : error instanceof Error
              ? error.message
              : "Hoshiyomi request failed",
        action,
      },
      { status: 502 }
    );
  }
}
