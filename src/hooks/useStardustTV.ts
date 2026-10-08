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
    category_p: "stardusttv",
    lang: "id",
    ...params,
  });

  const response = await fetch("/api/stardusttv?" + query.toString(), {
    cache: "no-store",
  });

  const raw = await response.text();

  let json: any;

  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(
      "Respons StardustTV bukan JSON (HTTP " + response.status + ")",
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

export function useStardustTVHome() {
  return useQuery({
    queryKey: ["stardusttv", "home", "id"],
    queryFn: async () => {
      const response = await request("/api/v2/homeDrama");

      return list(response)
        .map(mapDrama)
        .filter((item) => item.bookId && item.bookName !== "Untitled");
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useStardustTVDetail(id: string) {
  return useQuery({
    queryKey: ["stardusttv", "detail", id],
    enabled: Boolean(id),
    queryFn: () => request("/api/v2/detailDrama", { id }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export async function getStardustTVStream(
  id: string,
  episode: string,
) {
  return request("/api/v2/videoStream", {
    id,
    episode,
  });
}

export function extractStardustStream(value: any): string {
  const visited = new Set<any>();

  function walk(node: any, depth = 0): string {
    if (depth > 8 || node == null) return "";

    if (typeof node === "string") {
      return /^https?:\/\//i.test(node) ? node : "";
    }

    if (typeof node !== "object" || visited.has(node)) return "";
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        const result = walk(item, depth + 1);
        if (result) return result;
      }
      return "";
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

    for (const key of preferredKeys) {
      const value = node[key];
      if (typeof value === "string" && /^https?:\/\//i.test(value)) {
        return value;
      }
    }

    for (const key of Object.keys(node)) {
      const result = walk(node[key], depth + 1);
      if (result) return result;
    }

    return "";
  }

  return walk(value);
}

export function extractStardustEpisodes(value: any): any[] {
  return list(value);
}

export function extractStardustText(
  value: any,
  keys: string[],
  fallback = "",
): string {
  if (!value || typeof value !== "object") return fallback;

  const direct = pick(value, keys);
  if (direct) return direct;

  for (const key of Object.keys(value)) {
    const nested = extractStardustText(value[key], keys, "");
    if (nested) return nested;
  }

  return fallback;
}
