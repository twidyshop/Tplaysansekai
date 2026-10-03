"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Hls from "hls.js";

interface Episode {
  id: string;
  number: number;
  title: string;
  [key: string]: any;
}

function findArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["data", "episodes", "list", "rows", "results", "items", "chapters"]) {
    if (Array.isArray(value[key])) return value[key];
    const nested = findArray(value[key]);
    if (nested.length) return nested;
  }
  return [];
}

function text(value: any, keys: string[], fallback = "") {
  for (const key of keys) {
    const v = value?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

function getEpisode(item: any, index: number): Episode {
  return {
    id: text(item, ["id", "episodeId", "episode_id", "chapterId", "chapter_id"], String(index + 1)),
    number: Number(item?.episode ?? item?.episodeNumber ?? item?.episode_index ?? item?.index ?? index + 1) || index + 1,
    title: text(item, ["title", "name", "episodeTitle", "chapterName", "chapter_name"], "Episode " + (index + 1)),
    ...item,
  };
}

function findStream(value: any): { hlsUrl: string; subtitles: any[] } {
  const source = value?.data ?? value?.result ?? value;
  const hlsUrl =
    (typeof source?.hlsUrl === "string" && source.hlsUrl) ||
    (typeof source?.hls === "string" && source.hls) ||
    (typeof source?.m3u8 === "string" && source.m3u8) ||
    "";

  const subtitles =
    source?.subtitles ||
    source?.subtitle ||
    source?.subtitlesList ||
    [];

  return {
    hlsUrl,
    subtitles: Array.isArray(subtitles) ? subtitles : [],
  };
}

function rewriteHlsManifest(manifest: string) {
  return manifest.replace(/https?:\/\/[^\s"'\\]+/g, (url) => {
    if (/\.ts(?:\?|$)/i.test(url) || /\.m3u8(?:\?|$)/i.test(url)) {
      return "/api/iqiyi/proxy?url=" + encodeURIComponent(url);
    }
    return url;
  });
}
