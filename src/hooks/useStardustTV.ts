"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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

  const rawTags = item?.genres ?? item?.tags ?? item?.labels ?? item?.typeTwoNames ?? [];
  const tags = Array.isArray(rawTags)
    ? rawTags.map((tag: any) => typeof tag === "string" ? tag.trim() : pick(tag, ["name", "genreName", "tagName", "title"])).filter(Boolean)
    : typeof rawTags === "string" ? rawTags.split(/[,，|]/).map((tag) => tag.trim()).filter(Boolean) : [];

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
    tags,
    tagNames: tags,
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
  const query = useInfiniteQuery({
    queryKey: ["stardusttv", "home", "id"],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await request("/api/v2/home", {
        page: String(pageParam),
        limit: "20",
      });
      const items = list(response);
      return {
        dramas: items
          .map(mapDrama)
          .filter((item) => item.bookId && item.bookName !== "Untitled"),
        page: pageParam,
        hasMore: items.length > 0,
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.dramas.length === 0) return undefined;

      const previousIds = new Set(
        allPages
          .slice(0, -1)
          .flatMap((page) => page.dramas.map((drama) => drama.bookId)),
      );
      const hasNewDrama = lastPage.dramas.some(
        (drama) => !previousIds.has(drama.bookId),
      );

      return hasNewDrama ? lastPage.page + 1 : undefined;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const seen = new Set<string>();
  const dramas = query.data?.pages.flatMap((page) =>
    page.dramas.filter((drama) => {
      if (seen.has(drama.bookId)) return false;
      seen.add(drama.bookId);
      return true;
    }),
  );

  return { ...query, data: dramas };
}

export function useStardustTVDetail(id: string) {
  return useQuery({
    queryKey: ["stardusttv", "detail", id],
    enabled: Boolean(id),
    queryFn: () => request("/api/v2/detail", { id }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export async function getStardustTVStream(
  id: string,
  chapterId: string,
) {
  return request("/api/v2/video", {
    id,
    chapterId,
  });
}

export type StardustSubtitle = {
  url: string;
  language: string;
  label: string;
  format: string;
};

export function extractStardustSubtitles(value: any): StardustSubtitle[] {
  const found: StardustSubtitle[] = [];
  const seen = new Set<string>();
  const subtitleKeys = ["subtitles", "subtitleList", "subtitle_list", "subtitleTracks", "subtitle_tracks", "captions", "textTracks", "text_tracks"];
  const urlKeys = ["url", "subtitleUrl", "subtitle_url", "fileUrl", "file_url", "src", "uri", "link", "vtt", "webvtt"];
  const languageKeys = ["language", "lang", "languageCode", "language_code", "langCode", "lang_code", "locale"];

  function walk(node: any, depth = 0) {
    if (!node || typeof node !== "object" || depth > 9) return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, depth + 1));
      return;
    }

    for (const key of subtitleKeys) {
      const entries = node[key];
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (!entry || typeof entry !== "object") continue;
          const url = pick(entry, urlKeys);
          if (!/^https?:\/\//i.test(url)) continue;
          const language = pick(entry, languageKeys, "und");
          const label = pick(entry, ["label", "name", "title", "languageName", "language_name"], language);
          const format = pick(entry, ["format", "type", "mimeType", "mime_type"], url.split("?")[0].split(".").pop() || "vtt");
          const key = url + "|" + language;
          if (!seen.has(key)) {
            seen.add(key);
            found.push({ url, language, label, format });
          }
        }
      } else if (entries && typeof entries === "object") {
        walk(entries, depth + 1);
      }
    }

    for (const key of Object.keys(node)) {
      if (!subtitleKeys.includes(key)) walk(node[key], depth + 1);
    }
  }

  walk(value);
  return found;
}

export function extractStardustStream(value: any): string {
  const visited = new Set<any>();
  const preferredKeys = [
    "videoUrl", "video_url", "playUrl", "play_url", "streamUrl", "stream_url",
    "m3u8", "m3u8Url", "hls", "hlsUrl", "mp4", "url",
  ];

  function walk(node: any, depth = 0): string {
    if (depth > 8 || node == null || typeof node !== "object" || visited.has(node)) return "";
    visited.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const result = walk(item, depth + 1);
        if (result) return result;
      }
      return "";
    }

    // Only inspect stream-shaped objects. Do not accidentally select a
    // subtitle URL as the video source when the API returns both.
    for (const key of preferredKeys) {
      const candidate = node[key];
      if (typeof candidate === "string" && /^https?:\/\//i.test(candidate) &&
          !/subtitle|caption|\.vtt(?:$|\?)|\.srt(?:$|\?)|\.ass(?:$|\?)/i.test(candidate)) {
        return candidate;
      }
    }

    for (const key of Object.keys(node)) {
      if (["subtitles", "subtitleList", "subtitle_list", "subtitleTracks", "subtitle_tracks", "captions", "textTracks", "text_tracks"].includes(key)) continue;
      const result = walk(node[key], depth + 1);
      if (result) return result;
    }
    return "";
  }

  return walk(value);
}

export function extractStardustEpisodes(value: any): any[] {
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
