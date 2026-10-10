import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;
export const maxDuration = 60;

const BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";
const ACTIONS = new Set(["home", "latest", "trending", "hotrank", "recommended", "browse", "categories", "foryou", "populersearch", "search", "detail", "episodes", "play", "hls", "languages"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const action = params.get("action") || "home";
  if (!ACTIONS.has(action)) return NextResponse.json({ error: "Action DramaBox V2 tidak valid." }, { status: 400 });
  const key = process.env.HOSHIYOMI_API_KEY;
  if (!key) return NextResponse.json({ error: "HOSHIYOMI_API_KEY belum dikonfigurasi di Vercel." }, { status: 500 });

  const id = params.get("id") || "";
  const ep = params.get("ep") || params.get("episode") || "1";
  const query = params.get("query") || params.get("q") || "";
  const lang = params.get("lang") || "id";
  const pathByAction: Record<string, string> = {
    home: "/api/dramaboxv2/trending",
    latest: "/api/dramaboxv2/latest",
    trending: "/api/dramaboxv2/trending",
    hotrank: "/api/dramaboxv2/hotrank",
    recommended: "/api/dramaboxv2/recommended",
    browse: "/api/dramaboxv2/browse",
    categories: "/api/dramaboxv2/categories",
    foryou: "/api/dramaboxv2/foryou",
    populersearch: "/api/dramaboxv2/populersearch",
    search: "/api/dramaboxv2/search",
    detail: "/api/dramaboxv2/detail",
    episodes: "/api/dramaboxv2/allepisode",
    play: "/api/dramaboxv2/episode",
    hls: "/api/dramaboxv2/hls",
    languages: "/api/dramaboxv2/languages",
  };
  const target = new URL(pathByAction[action], BASE);
  if (["home", "latest", "trending", "recommended", "browse", "foryou"].includes(action)) target.searchParams.set("page", params.get("page") || "1");
  if (action === "latest") target.searchParams.set("pageSize", params.get("pageSize") || "50");
  if (action === "hotrank") target.searchParams.set("type", params.get("type") || "1");
  if (action === "search") {
    if (!query.trim()) return NextResponse.json({ error: "Parameter query wajib diisi." }, { status: 400 });
    target.searchParams.set("query", query);
    target.searchParams.set("page", params.get("page") || "1");
  }
  if (["detail", "episodes", "play", "hls"].includes(action)) {
    if (!id) return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
    target.searchParams.set("id", id);
  }
  if (["play", "hls"].includes(action)) target.searchParams.set("ep", ep);
  if (action !== "languages") target.searchParams.set("lang", lang);
  const cursor = params.get("cursor");
  if (cursor && action === "recommended") target.searchParams.set("cursor", cursor);
  const category = params.get("category") || params.get("categoryId");
  if (category && action === "browse") target.searchParams.set("category", category);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ["play", "hls"].includes(action) ? 45000 : 30000);
  try {
    console.log(`[DramaBox V2] ${action} -> ${target.pathname}${target.search}`);
    const response = await fetch(target.toString(), {
      headers: { "X-API-Key": key, Accept: "application/json", "User-Agent": "TPLAY+/1.0" },
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await response.text();
    clearTimeout(timeout);
    console.log(`[DramaBox V2] ${action} <- ${response.status} (${raw.length} bytes)`);
    let data: any;
    try { data = JSON.parse(raw); } catch {
      return NextResponse.json({ error: "Hoshiyomi DramaBox V2 mengembalikan response non-JSON.", status: response.status }, { status: response.ok ? 502 : response.status });
    }
    if (!response.ok || data?.success === false || data?.error) {
      return NextResponse.json({ error: data?.message || data?.error || "Hoshiyomi DramaBox V2 request gagal.", status: response.status }, { status: response.status });
    }
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": ["play", "hls"].includes(action) ? "no-store" : "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : "Unknown upstream error";
    console.error(`[DramaBox V2] ${action} failed:`, message);
    return NextResponse.json({ error: error instanceof Error && error.name === "AbortError" ? "Hoshiyomi DramaBox V2 timeout." : `Gagal menghubungi Hoshiyomi DramaBox V2: ${message}` }, { status: 502 });
  }
}
