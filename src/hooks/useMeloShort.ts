"use client";

import { useQuery } from "@tanstack/react-query";
import type { Drama } from "@/types/drama";

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function pick(value: any, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const result = text(value?.[key]);
    if (result) return result;
  }
  return fallback;
}

function list(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const key of [
    "data",
    "list",
    "items",
    "results",
    "dramas",
    "books",
    "records",
    "episodes",
    "episodeList",
    "episode_list",
    "chapters",
    "chapterList",
    "chapter_list",
    "videos",
    "videoList",
    "video_list",
  ]) {
    if (Array.isArray(value[key])) return value[key];

    const nested = list(value[key]);
    if (nested.length) return nested;
  }

  return [];
}

function mapDrama(item: any): Drama {
  const bookId = pick(item, [
    "id",
    "bookId",
    "book_id",
    "dramaId",
    "drama_id",
    "videoId",
  ]);

  const bookName = pick(item, [
    "title",
    "bookName",
    "book_name",
    "dramaName",
    "name",
  ], "Untitled");

  const cover = pick(item, [
    "cover",
    "coverUrl",
    "cover_url",
    "poster",
    "posterUrl",
    "image",
    "thumbnail",
    "book_pic",
  ]);

  const chapterCount = Number(
    item?.chapterCount ??
      item?.chapter_count ??
      item?.episodeCount ??
      item?.episode_count ??
      item?.totalEpisodes ??
      item?.total_episodes ??
      0,
  );

  return {
    bookId,
    bookName,
    cover,
    coverWap: cover,
    chapterCount: Number.isFinite(chapterCount) ? chapterCount : 0,
    introduction: pick(item, [
      "synopsis",
      "introduction",
      "description",
      "desc",
      "summary",
    ]),
    tags: [],
    inLibrary: Boolean(item?.inLibrary ?? false),
  };
}

async function request(path: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({
    path,
    category_p: "meloshort",
    lang: "id",
    ...params,
  });

  const response = await fetch("/api/meloshort?" + query.toString(), {
    cache: "no-store",
  });

  const raw = await response.text();

  let json: any;

  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(
      "Respons MeloShort bukan JSON (HTTP " + response.status + ")",
    );
  }

  if (!response.ok || json?.success === false) {
    throw new Error(
      json?.error ||
        json?.message ||
        "QuickPlay HTTP " + response.status,
    );
  }

  return json;
}

export function useMeloShortDramas() {
  return useQuery({
    queryKey: ["meloshort", "home", "id"],
    queryFn: async () => {
      const response = await request("/api/v2/home");

      return list(response)
        .map(mapDrama)
        .filter((item) => item.bookId && item.bookName !== "Untitled");
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useMeloShortDetail(id: string) {
  return useQuery({
    queryKey: ["meloshort", "detail", id],
    enabled: Boolean(id),
    queryFn: () => request("/api/v2/detail", { id }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export async function getMeloShortStream(
  id: string,
  chapterId: string,
) {
  return request("/api/v2/video", {
    id,
    chapterId,
  });
}

export function extractMeloShortStream(value: any): string {
  const candidates: Array<{ url: string; score: number }> = [];
  const visited = new Set<any>();

  function addCandidate(url: string, node: any, key = "") {
    if (!/^https?:\/\//i.test(url)) return;

    const text = JSON.stringify(node ?? {}).toLowerCase();
    const keyText = key.toLowerCase();

    // QuickPlay can return separate audio/video streams. The old extractor
    // picked the first URL, which could be the audio rendition and caused
    // MeloShort to play sound with a black video area.
    let score = 0;

    if (/video|visual|avc|h264|h265|hevc|vp8|vp9/.test(text)) score += 100;
    if (/video|visual/.test(keyText)) score += 80;
    if (/audio|sound|aac|mp3|opus/.test(text)) score -= 100;
    if (/audio|sound/.test(keyText)) score -= 80;

    if (/\\.(m3u8|mp4|m4v)(?:$|[?#])/i.test(url)) score += 20;
    if (/\\.(mp3|aac|m4a|opus|wav)(?:$|[?#])/i.test(url)) score -= 100;

    // Prefer a stream explicitly marked as video over a generic URL.
    if (
      node &&
      typeof node === "object" &&
      !Array.isArray(node) &&
      (node.type === "video" ||
        node.mediaType === "video" ||
        node.mimeType?.toString().toLowerCase().startsWith("video/"))
    ) {
      score += 150;
    }

    candidates.push({ url, score });
  }

  function walk(node: any, depth = 0, key = "") {
    if (depth > 10 || node == null) return;
    if (typeof node === "string") {
      addCandidate(node, node, key);
      return;
    }
    if (typeof node !== "object" || visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1, key);
      return;
    }

    const preferredKeys = [
      "videoUrl",
      "video_url",
      "playUrl",
      "play_url",
      "streamUrl",
      "stream_url",
      "m3u8",
      "m3u8Url",
      "hls",
      "hlsUrl",
      "mp4",
      "url",
    ];

    for (const keyName of preferredKeys) {
      const candidate = node[keyName];
      if (typeof candidate === "string") {
        addCandidate(candidate, node, keyName);
      }
    }

    for (const [childKey, child] of Object.entries(node)) {
      walk(child, depth + 1, childKey);
    }
  }

  walk(value);

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url || "";
}

export function extractMeloShortEpisodes(value: any): any[] {
  if (!value || typeof value !== "object") return [];

  const preferredKeys = [
    "episodes",
    "episodeList",
    "episode_list",
    "chapters",
    "chapterList",
    "chapter_list",
    "videos",
    "videoList",
    "video_list",
  ];

  function find(node: any, depth = 0): any[] {
    if (depth > 10 || node == null || typeof node !== "object") {
      return [];
    }

    if (Array.isArray(node)) {
      return node;
    }

    for (const key of preferredKeys) {
      const candidate = node[key];

      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate;
      }

      const nested = find(candidate, depth + 1);
      if (nested.length > 0) {
        return nested;
      }
    }

    for (const key of Object.keys(node)) {
      if (preferredKeys.includes(key)) continue;

      const nested = find(node[key], depth + 1);
      if (
        nested.length > 0 &&
        nested.some(
          (item) =>
            item &&
            typeof item === "object" &&
            ("episode" in item ||
              "episodeNumber" in item ||
              "episode_index" in item ||
              "index" in item ||
              "id" in item ||
              "videoId" in item ||
              "video_id" in item),
        )
      ) {
        return nested;
      }
    }

    return [];
  }

  return find(value);
}

export function extractMeloShortText(
  value: any,
  keys: string[],
  fallback = "",
): string {
  if (!value || typeof value !== "object") return fallback;

  const direct = pick(value, keys);
  if (direct) return direct;

  for (const key of Object.keys(value)) {
    const nested = extractMeloShortText(value[key], keys, "");
    if (nested) return nested;
  }

  return fallback;
}
