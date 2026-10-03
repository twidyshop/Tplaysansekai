import { NextResponse } from "next/server";

const HOSHIYOMI_API =
  process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";

const ACTIONS = new Set(["home", "search", "detail", "episodes", "play"]);

function buildUrl(path: string, params: URLSearchParams) {
  const url = new URL(path, HOSHIYOMI_API);
  params.forEach((value, key) => {
    if (key !== "action") url.searchParams.set(key, value);
  });
  return url;
}

function candidates(action: string, params: URLSearchParams) {
  const id = params.get("id") || params.get("dramaId") || "";
  const episode = params.get("episode") || params.get("ep") || "1";
  const query = params.get("query") || params.get("q") || params.get("keyword") || "";

  switch (action) {
    case "home":
      return [
        buildUrl("/api/iqiyi/home", params),
        buildUrl("/api/iqiyi/trending", params),
        buildUrl("/api/iqiyi", params),
      ];
    case "search":
      return [
        buildUrl("/api/iqiyi/search", new URLSearchParams({ query })),
        buildUrl("/api/iqiyi/search", new URLSearchParams({ q: query })),
        buildUrl("/api/iqiyi/search", new URLSearchParams({ keyword: query })),
      ];
    case "detail":
      return [
        buildUrl("/api/iqiyi/detail", new URLSearchParams({ id })),
        new URL("/api/iqiyi/detail/" + encodeURIComponent(id), HOSHIYOMI_API),
      ];
    case "episodes":
      return [
        buildUrl("/api/iqiyi/episodes", new URLSearchParams({ id })),
        new URL("/api/iqiyi/episodes/" + encodeURIComponent(id), HOSHIYOMI_API),
      ];
    case "play":
      return [
        buildUrl("/api/iqiyi/play", new URLSearchParams({ id, episode })),
        new URL(
          "/api/iqiyi/play/" + encodeURIComponent(id) + "/" + encodeURIComponent(episode),
          HOSHIYOMI_API
        ),
        buildUrl("/api/iqiyi/video", new URLSearchParams({ id, episode })),
      ];
    default:
      return [];
  }
}

function isUsableJson(data: any) {
  if (!data || typeof data !== "object") return false;
  if (data.success === false || data.status === "error" || data.error) return false;
  return true;
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

  let lastStatus = 502;
  let lastError = "Hoshiyomi request failed";

  for (const targetUrl of candidates(action, searchParams)) {
    try {
      const response = await fetch(targetUrl.toString(), {
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
          "User-Agent": "TPLAY+/1.0",
        },
        cache: "no-store",
      });

      lastStatus = response.status;
      const text = await response.text();
      let data: any;

      try {
        data = JSON.parse(text);
      } catch {
        lastError = "Hoshiyomi returned non-JSON response (HTTP " + response.status + ")";
        continue;
      }

      if (!response.ok || !isUsableJson(data)) {
        lastError =
          data?.message ||
          data?.error ||
          "Hoshiyomi request failed (HTTP " + response.status + ")";
        continue;
      }

      return NextResponse.json(data, {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Hoshiyomi request failed";
    }
  }

  return NextResponse.json(
    { error: lastError, status: lastStatus, action },
    { status: lastStatus >= 400 ? lastStatus : 502 }
  );
}
