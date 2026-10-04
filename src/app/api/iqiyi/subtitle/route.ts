import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const BASE = process.env.HOSHIYOMI_API_BASE_URL || "https://api.hoshiyomi.my.id";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Origin, Accept, Content-Type",
    "Access-Control-Expose-Headers": "Content-Type, Content-Length",
  };
}

function looksLikeUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function looksLikeSubtitleUrl(value: string) {
  return /\.(?:vtt|srt|ass|ssa)(?:[?#]|$)/i.test(value) ||
    /(?:subtitle|subtitles|caption|captions|sub=|subtitles=)/i.test(value);
}

function normalizeLanguage(value: unknown) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "";
  if (/^(id|in|ind|indonesia|bahasa indonesia|id-id)$/.test(s)) return "id";
  if (/^(en|eng|english|en-us|en-gb)$/.test(s)) return "en";
  if (/^(zh|zho|chi|chinese|zh-cn|zh-hans)$/.test(s)) return "zh";
  if (/^(ja|jpn|japanese)$/.test(s)) return "ja";
  if (/^(ko|kor|korean)$/.test(s)) return "ko";
  return s.slice(0, 12);
}

function labelFor(language: string, fallback = "Subtitle") {
  if (language === "id") return "Indonesia";
  if (language === "en") return "English";
  if (language === "zh") return "中文";
  if (language === "ja") return "日本語";
  if (language === "ko") return "한국어";
  return fallback;
}

function candidateUrl(value: any): string {
  if (typeof value === "string" && looksLikeUrl(value)) return value.trim();
  if (!value || typeof value !== "object") return "";
  for (const key of [
    "url","src","source","file","fileUrl","file_url","subtitleUrl","subtitle_url",
    "captionUrl","caption_url","vtt","vttUrl","vtt_url","srt","srtUrl","srt_url",
    "downloadUrl","download_url","uri"
  ]) {
    const v = value[key];
    if (looksLikeUrl(v)) return String(v).trim();
  }
  return "";
}

function candidateLanguage(value: any): string {
  if (!value || typeof value !== "object") return "";
  for (const key of ["language","lang","srclang","languageCode","language_code","locale","langCode","lang_code","code"]) {
    const normalized = normalizeLanguage(value[key]);
    if (normalized) return normalized;
  }
  const text = [value.label, value.name, value.title, value.languageName, value.language_name]
    .filter(Boolean).join(" ");
  return normalizeLanguage(text);
}

function collectSubtitles(value: any, out: any[] = [], seen = new Set<any>(), depth = 0) {
  if (depth > 12 || value == null || typeof value !== "object" || seen.has(value)) return out;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectSubtitles(item, out, seen, depth + 1);
    return out;
  }

  for (const key of Object.keys(value)) {
    const child = value[key];
    const lower = key.toLowerCase();
    const subtitleKey = /subtitle|caption|closed.?caption|subtitles/.test(lower);

    if (subtitleKey) {
      if (typeof child === "string" && looksLikeUrl(child) && looksLikeSubtitleUrl(child)) {
        out.push({ url: child.trim(), language: "", label: "Subtitle" });
      } else if (Array.isArray(child)) {
        for (const item of child) {
          const url = candidateUrl(item);
          if (url && looksLikeSubtitleUrl(url)) {
            const language = candidateLanguage(item);
            const label = String(item?.label || item?.name || item?.title || labelFor(language)).trim();
            out.push({ url, language, label });
          }
          collectSubtitles(item, out, seen, depth + 1);
        }
      } else if (child && typeof child === "object") {
        const url = candidateUrl(child);
        if (url && looksLikeSubtitleUrl(url)) {
          const language = candidateLanguage(child);
          const label = String(child?.label || child?.name || child?.title || labelFor(language)).trim();
          out.push({ url, language, label });
        }
        collectSubtitles(child, out, seen, depth + 1);
      }
    }

    collectSubtitles(child, out, seen, depth + 1);
  }
  return out;
}

function uniqueTracks(data: any) {
  const found = collectSubtitles(data);
  const seen = new Set<string>();
  return found.filter((x) => {
    const key = x.url + "|" + x.language + "|" + x.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((x) => ({
    label: x.language ? labelFor(x.language, x.label) : x.label,
    language: x.language || "und",
    url: x.url,
  }));
}

function toProxyUrl(request: Request, target: string) {
  return new URL("/api/iqiyi/subtitle?url=" + encodeURIComponent(target), request.url).toString();
}

function srtToVtt(srt: string) {
  const normalized = srt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "WEBVTT\n\n";
  const blocks = normalized.split(/\n{2,}/);
  const out = ["WEBVTT", ""];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timeIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeIndex < 0) continue;
    const timing = lines[timeIndex].replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, "$1.$2");
    const text = lines.slice(timeIndex + 1).join("\n").trim();
    if (!text) continue;
    out.push(timing, text, "");
  }
  return out.join("\n");
}

async function fetchHoshiyomi(id: string, episode: string, albumId: string, key: string) {
  const target = new URL("/api/iqiyi/episode", BASE);
  target.searchParams.set("id", id);
  target.searchParams.set("ep", episode);
  target.searchParams.set("lang", "id");
  if (albumId) target.searchParams.set("albumId", albumId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    return await fetch(target.toString(), {
      headers: { "X-API-Key": key, Accept: "application/json", "User-Agent": "TPLAY+/1.0" },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const url = p.get("url");

  if (url) {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL subtitle tidak valid." }, { status: 400, headers: corsHeaders() });
    }

    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return NextResponse.json({ error: "Protocol subtitle tidak diizinkan." }, { status: 400, headers: corsHeaders() });
    }

    try {
      const upstream = await fetch(target.toString(), {
        headers: {
          Referer: "https://www.iq.com/",
          Origin: "https://www.iq.com",
          Accept: "text/vtt,text/plain,application/x-subrip,*/*",
          "Accept-Encoding": "identity",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
        },
        redirect: "follow",
        cache: "no-store",
      });

      const raw = await upstream.text();
      if (!upstream.ok) {
        return new NextResponse(raw, { status: upstream.status, headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" } });
      }

      const contentType = upstream.headers.get("content-type") || "";
      const isSrt = /subrip|srt/i.test(contentType) || /\.srt(?:[?#]|$)/i.test(upstream.url || target.toString()) || !/^\s*WEBVTT\b/i.test(raw);
      const vtt = isSrt ? srtToVtt(raw) : raw.replace(/^\uFEFF/, "");
      return new NextResponse(vtt, {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "no-store" },
      });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengambil subtitle." }, { status: 502, headers: corsHeaders() });
    }
  }

  const id = p.get("id") || "";
  const episode = p.get("episode") || p.get("ep") || "1";
  const albumId = p.get("albumId") || "";
  const key = process.env.HOSHIYOMI_API_KEY;

  if (!id) return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400, headers: corsHeaders() });
  if (!key) return NextResponse.json({ error: "HOSHIYOMI_API_KEY belum dikonfigurasi." }, { status: 500, headers: corsHeaders() });

  try {
    const upstream = await fetchHoshiyomi(id, episode, albumId, key);
    const raw = await upstream.text();
    let data: any;
    try { data = JSON.parse(raw); } catch {
      return NextResponse.json({ error: "Hoshiyomi mengembalikan response non-JSON.", status: upstream.status }, { status: 502, headers: corsHeaders() });
    }

    if (!upstream.ok || data?.success === false || data?.error) {
      return NextResponse.json({ tracks: [], error: data?.message || data?.error || "Subtitle iQIYI tidak tersedia." }, { status: upstream.status || 502, headers: corsHeaders() });
    }

    const tracks = uniqueTracks(data).map((track) => ({
      label: track.label,
      language: track.language,
      src: toProxyUrl(request, track.url),
    }));

    return NextResponse.json({ tracks }, {
      status: 200,
      headers: { ...corsHeaders(), "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({
      tracks: [],
      error: error instanceof Error && error.name === "AbortError" ? "Request subtitle timeout setelah 25 detik." : error instanceof Error ? error.message : "Gagal mengambil subtitle iQIYI.",
    }, { status: 502, headers: corsHeaders() });
  }
}
