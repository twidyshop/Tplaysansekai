"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetcher";

export interface IqiyiDetailResponse {
  success?: boolean;
  data?: any;
  error?: string;
  [key: string]: any;
}

export interface IqiyiEpisodesResponse {
  success?: boolean;
  data?: any;
  error?: string;
  [key: string]: any;
}

export interface IqiyiPlayResponse {
  success?: boolean;
  data?: any;
  error?: string;
  [key: string]: any;
}

function params(id: string, albumId?: string) {
  return new URLSearchParams({
    id,
    ...(albumId ? { albumId } : {}),
    lang: "id",
  });
}

export function useIqiyiDetail(id: string, albumId?: string) {
  const qs = params(id, albumId);
  return useQuery<IqiyiDetailResponse>({
    queryKey: ["iqiyi", "detail", id, albumId || ""],
    queryFn: () => fetchJson<IqiyiDetailResponse>(`/api/iqiyi?action=detail&${qs.toString()}`),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

export function useIqiyiEpisodes(id: string, albumId?: string) {
  const qs = params(id, albumId);
  return useQuery<IqiyiEpisodesResponse>({
    queryKey: ["iqiyi", "episodes", id, albumId || ""],
    queryFn: () => fetchJson<IqiyiEpisodesResponse>(`/api/iqiyi?action=episodes&${qs.toString()}`),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });
}

export function useIqiyiPlay(id: string, episode: number, albumId?: string) {
  const qs = params(id, albumId);
  qs.set("episode", String(episode));
  return useQuery<IqiyiPlayResponse>({
    queryKey: ["iqiyi", "play", id, albumId || "", episode],
    queryFn: () => fetchJson<IqiyiPlayResponse>(`/api/iqiyi?action=play&${qs.toString()}`),
    enabled: !!id && episode > 0,
    staleTime: 60 * 1000,
    retry: 0,
  });
}
