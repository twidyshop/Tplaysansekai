"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";

export interface WatchHistoryItem {
  id: string;
  title: string;
  image: string;
  platform: string;
  timestamp: number;
  url: string;
  episode?: number;
  totalEpisodes?: number;
}

interface WatchHistoryStore {
  items: WatchHistoryItem[];
  addItem: (item: WatchHistoryItem) => void;
  removeItem: (id: string) => void;
  clearHistory: () => void;
  getHistory: () => WatchHistoryItem[];
}

const STORAGE_KEY = "tplay_watch_history";
const MAX_HISTORY = 20;

const normalizePlatform = (platform: string) =>
  String(platform || "").trim().toLowerCase();

const makeHistoryId = (platform: string, id: string) => {
  const normalizedPlatform = normalizePlatform(platform);
  const rawId = String(id || "").trim();

  // Hindari ID berulang seperti stardusttv:stardusttv:19962
  const prefix = normalizedPlatform + ":";
  let cleanId = rawId;

  // Collapse legacy IDs that were accidentally prefixed more than once,
  // e.g. stardusttv:stardusttv:19962 -> 19962.
  while (cleanId.toLowerCase().startsWith(prefix)) {
    cleanId = cleanId.slice(prefix.length);
  }

  return prefix + cleanId;
};

export const useWatchHistoryStore = create<WatchHistoryStore>((set, get) => ({
  items: [],

  addItem: (item: WatchHistoryItem) => {
    const current = get().items;
    const historyId = makeHistoryId(item.platform, item.id);

    const normalizedItem: WatchHistoryItem = {
      ...item,
      id: historyId,
      title: String(item.title || "").trim(),
      image: String(item.image || ""),
      platform: String(item.platform || "").trim(),
      url: String(item.url || "#"),
      timestamp: Date.now(),
    };

    const filtered = current.filter(
      (existing) =>
        makeHistoryId(existing.platform, existing.id) !== historyId,
    );

    const updated = [normalizedItem, ...filtered].slice(0, MAX_HISTORY);

    set({ items: updated });

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  },

  removeItem: (id: string) => {
    const updated = get().items.filter((i) => i.id !== id);
    set({ items: updated });

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  },

  clearHistory: () => {
    set({ items: [] });

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  getHistory: () => get().items,
}));

export function useWatchHistory() {
  const [mounted, setMounted] = useState(false);
  const store = useWatchHistoryStore();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        try {
          const parsed = JSON.parse(saved);

          if (Array.isArray(parsed)) {
            const items: WatchHistoryItem[] = parsed
              .filter((item: any) => item && item.id)
              .map((item: any) => {
                const platform = String(item.platform || "").trim();
                const id = makeHistoryId(platform, String(item.id));

                return {
                  id,
                  title: String(item.title || "").trim(),
                  image: String(item.image || ""),
                  platform,
                  timestamp: Number(item.timestamp || Date.now()),
                  url: String(item.url || "#"),
                  episode:
                    typeof item.episode === "number"
                      ? item.episode
                      : undefined,
                  totalEpisodes:
                    typeof item.totalEpisodes === "number"
                      ? item.totalEpisodes
                      : undefined,
                };
              });

            // Deduplicate after normalizing IDs. If a legacy generic
            // StardustTV entry exists, prefer the newer entry with a real
            // title/episode instead of keeping "Drama Pilihan".
            const byId = new Map<string, WatchHistoryItem>();

            for (const item of items) {
              const existing = byId.get(item.id);
              const genericStardustTitle =
                item.platform.toLowerCase() === "stardusttv" &&
                ["drama pilihan", "stardusttv", "untitled", "drama"].includes(
                  item.title.toLowerCase(),
                );

              if (!existing) {
                byId.set(item.id, item);
                continue;
              }

              const existingGenericStardust =
                existing.platform.toLowerCase() === "stardusttv" &&
                ["drama pilihan", "stardusttv", "untitled", "drama"].includes(
                  existing.title.toLowerCase(),
                );

              if (existingGenericStardust && !genericStardustTitle) {
                byId.set(item.id, item);
              }
            }

            const deduped = Array.from(byId.values())
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, MAX_HISTORY);

            useWatchHistoryStore.setState({ items: deduped });

            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(deduped),
            );
          }
        } catch (e) {
          console.error("Failed to load watch history:", e);
        }
      }
    }

    setMounted(true);
  }, []);

  return {
    ...store,
    mounted,
  };
}
