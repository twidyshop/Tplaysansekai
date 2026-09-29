"use client";

import { useEffect, useState } from "zustand";
import { create } from "zustand";

export interface WatchHistoryItem {
  id: string;
  title: string;
  image: string;
  platform: string;
  timestamp: number;
  url: string;
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
    const filtered = current.filter(i => i.id !== item.id);
    const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
    
    set({ items: updated });
    
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  },
  
  removeItem: (id: string) => {
    const updated = get().items.filter(i => i.id !== id);
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
          const items = JSON.parse(saved);
          useWatchHistoryStore.setState({ items });
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
