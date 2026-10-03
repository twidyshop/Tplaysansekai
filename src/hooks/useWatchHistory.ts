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

  // Informasi episode
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

export const useWatchHistoryStore = create<WatchHistoryStore>((set, get) => ({
  items: [],

  addItem: (item: WatchHistoryItem) => {
    const current = get().items;

    /*
     * ID dibuat berdasarkan platform + drama ID.
     * Jadi drama dengan ID sama dari platform berbeda
     * tidak akan saling menimpa.
     */
    const historyId = `${item.platform.toLowerCase()}:${item.id}`;

    const normalizedItem: WatchHistoryItem = {
      ...item,
      id: historyId,
      timestamp: Date.now(),
    };

    const filtered = current.filter((i) => {
      /*
       * History lama mungkin masih menggunakan ID biasa.
       * Kita cocokkan berdasarkan ID baru maupun kombinasi platform + ID.
       */
      const existingHistoryId = `${i.platform.toLowerCase()}:${i.id}`;

      return (
        i.id !== historyId &&
        existingHistoryId !== historyId
      );
    });

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
            /*
             * Normalisasi history lama supaya tidak error
             * setelah field episode ditambahkan.
             */
            const items: WatchHistoryItem[] = parsed
              .filter((item: any) => item && item.id)
              .map((item: any) => ({
                id: String(item.id),
                title: String(item.title || "Drama Pilihan"),
                image: String(item.image || ""),
                platform: String(item.platform || ""),
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
              }));

            useWatchHistoryStore.setState({ items });
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
