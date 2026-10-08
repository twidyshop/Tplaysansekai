import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "*/*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36",
  Referer: "https://api.meloshort.com/",
};

function resolveUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function getPlaylistUris(text: string, baseUrl: string) {
  const uris: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    uris.push(resolveUrl(trimmed, baseUrl));
  }

  const mapMatches = [...text.matchAll(/URI="([^"]+)"/gi)];
  for (const match of mapMatches) {
    uris.push(resolveUrl(match[1], baseUrl));
  }

  return [...new Set(uris)];
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes)
    .slice(0, 64)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function ascii(bytes: Uint8Array) {
  return Array.from(bytes)
    .slice(0, 64)
    .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
    .join("");
}

function detectFormat(bytes: Uint8Array, contentType: string) {
  const head = Array.from(bytes.slice(0, 12));
  const text = new TextDecoder().decode(bytes.slice(0, 64));
  const type = contentType.toLowerCase();

  if (head[0] === 0x47) return "mpeg-ts";
  if (
    head[0] === 0x00 &&
    head[1] === 0x00 &&
    head[2] === 0x00 &&
    head[3] === 0x18 &&
    text.includes("ftyp")
  ) {
    return "fmp4";
  }
  if (text.includes("ftyp") || text.includes("moof")) return "fmp4";
  if (type.includes("mp4")) return "fmp4";
  return "unknown";
}

async function fetchWithHeaders(url: string, range?: string) {
  const headers = { ...DEFAULT_HEADERS };
  if (range) headers.Range = range;

  return fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
    redirect: "follow",
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { success: false, error: "Parameter url wajib diisi" },
        { status: 400 }
      );
    }

    const first = await fetchWithHeaders(url);
    const firstType = first.headers.get("content-type") || "";
    const firstBody = await first.text();

    if (!first.ok) {
      return NextResponse.json({
        success: false,
        stage: "manifest",
        status: first.status,
        contentType: firstType,
        url,
        body: firstBody.slice(0, 2000),
      }, { status: 200 });
    }

    if (!firstBody.trim().startsWith("#EXTM3U")) {
      return NextResponse.json({
        success: false,
        stage: "manifest",
        reason: "Response bukan HLS playlist",
        status: first.status,
        contentType: firstType,
        url,
        bodyPreview: firstBody.slice(0, 4000),
      });
    }

    const playlists: Array<{
      url: string;
      status: number;
      contentType: string;
      body: string;
      uris: string[];
    }> = [];

    let currentUrl = url;
    let currentBody = firstBody;

    for (let depth = 0; depth < 3; depth++) {
      const uris = getPlaylistUris(currentBody, currentUrl);
      playlists.push({
        url: currentUrl,
        status: depth === 0 ? first.status : 200,
        contentType: depth === 0 ? firstType : "application/vnd.apple.mpegurl",
        body: currentBody.slice(0, 12000),
        uris,
      });

      const nextPlaylist = uris.find((u) => /\.m3u8(?:$|[?#])/i.test(u));
      if (!nextPlaylist) break;

      const response = await fetchWithHeaders(nextPlaylist);
      const type = response.headers.get("content-type") || "";
      const body = await response.text();

      if (!response.ok || !body.trim().startsWith("#EXTM3U")) break;

      currentUrl = nextPlaylist;
      currentBody = body;
    }

    const last = playlists[playlists.length - 1];
    const segmentUrl = last.uris.find((u) => !/\.m3u8(?:$|[?#])/i.test(u));

    let segment: Record<string, unknown> | null = null;

    if (segmentUrl) {
      const response = await fetchWithHeaders(segmentUrl, "bytes=0-63");
      const type = response.headers.get("content-type") || "";
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      segment = {
        url: segmentUrl,
        status: response.status,
        contentType: type,
        contentLength: response.headers.get("content-length"),
        contentRange: response.headers.get("content-range"),
        byteCountRead: bytes.length,
        firstBytesHex: hex(bytes),
        firstBytesAscii: ascii(bytes),
        detectedFormat: detectFormat(bytes, type),
      };
    }

    return NextResponse.json({
      success: true,
      sourceUrl: url,
      manifest: {
        status: first.status,
        contentType: firstType,
        levelsOrPlaylists: playlists.map((p) => ({
          url: p.url,
          status: p.status,
          contentType: p.contentType,
          uris: p.uris,
          body: p.body,
        })),
      },
      firstMediaSegment: segment,
      conclusion:
        segment?.detectedFormat === "mpeg-ts"
          ? "Segment pertama terdeteksi MPEG-TS."
          : segment?.detectedFormat === "fmp4"
            ? "Segment pertama terdeteksi fMP4."
            : "Format segment belum dapat dipastikan.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Debug HLS gagal",
      },
      { status: 500 }
    );
  }
}
