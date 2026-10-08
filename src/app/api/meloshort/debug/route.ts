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


function parseTsStreams(bytes: Uint8Array) {
  const streams = new Map<number, { pid: number; streamType: number; descriptors: number[] }>();
  let pmtPid = -1;
  for (let offset = 0; offset + 188 <= bytes.length; offset += 188) {
    if (bytes[offset] !== 0x47) continue;
    const pid = ((bytes[offset + 1] & 0x1f) << 8) | bytes[offset + 2];
    const afc = (bytes[offset + 3] >> 4) & 3;
    if (afc === 0 || afc === 2) continue;
    let pos = offset + 4;
    if (afc === 3) pos += 1 + (bytes[pos] ?? 0);
    if (pos >= offset + 188) continue;
    if (pid === 0) {
      const section = pos + 1 + (bytes[pos] ?? 0);
      if (section + 8 <= offset + 188 && bytes[section] === 0) {
        const len = ((bytes[section + 1] & 15) << 8) | bytes[section + 2];
        const end = Math.min(section + 3 + len - 4, offset + 188);
        for (let i = section + 8; i + 4 <= end; i += 4) {
          const program = (bytes[i] << 8) | bytes[i + 1];
          if (program) {
            pmtPid = ((bytes[i + 2] & 31) << 8) | bytes[i + 3];
            break;
          }
        }
      }
    }
  }
  if (pmtPid < 0) return { pmtPid: null, streams: [] };
  for (let offset = 0; offset + 188 <= bytes.length; offset += 188) {
    if (bytes[offset] !== 0x47) continue;
    const pid = ((bytes[offset + 1] & 0x1f) << 8) | bytes[offset + 2];
    if (pid !== pmtPid) continue;
    const afc = (bytes[offset + 3] >> 4) & 3;
    if (afc === 0 || afc === 2) continue;
    let pos = offset + 4;
    if (afc === 3) pos += 1 + (bytes[pos] ?? 0);
    if (pos >= offset + 188) continue;
    const section = pos + 1 + (bytes[pos] ?? 0);
    if (section + 12 > offset + 188 || bytes[section] !== 2) continue;
    const len = ((bytes[section + 1] & 15) << 8) | bytes[section + 2];
    const end = Math.min(section + 3 + len - 4, offset + 188);
    const infoLen = ((bytes[section + 10] & 15) << 8) | bytes[section + 11];
    let i = section + 12 + infoLen;
    while (i + 5 <= end) {
      const streamType = bytes[i];
      const pidValue = ((bytes[i + 1] & 31) << 8) | bytes[i + 2];
      const esLen = ((bytes[i + 3] & 15) << 8) | bytes[i + 4];
      const descriptors = Array.from(bytes.slice(i + 5, Math.min(i + 5 + esLen, end)));
      streams.set(pidValue, { pid: pidValue, streamType, descriptors });
      i += 5 + esLen;
    }
    break;
  }
  const codecNames: Record<number, string> = {
    1: "MPEG-1 Video", 2: "MPEG-2 Video", 3: "MPEG-1 Audio", 4: "MPEG-2 Audio",
    15: "AAC", 16: "MPEG-4 Video", 17: "AAC/HE-AAC", 27: "H.264/AVC",
    36: "H.265/HEVC", 129: "AC-3", 135: "E-AC-3",
  };
  return {
    pmtPid,
    streams: [...streams.values()].map((s) => ({
      pid: s.pid,
      streamTypeHex: "0x" + s.streamType.toString(16).padStart(2, "0"),
      codec: codecNames[s.streamType] || "Unknown",
      descriptorHex: s.descriptors.map((b) => b.toString(16).padStart(2, "0")).join(" "),
    })),
  };
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
      const response = await fetchWithHeaders(segmentUrl);
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
        tsStreams: detectFormat(bytes, type) === "mpeg-ts" ? parseTsStreams(bytes) : null,
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
