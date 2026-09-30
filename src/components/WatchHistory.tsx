"use client";

import { useState } from "react";
import { X, Trash2, Clock } from "lucide-react";
import Link from "next/link";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { optimizeThumb } from "@/lib/image-utils";

export function WatchHistory() {
  const { items, removeItem, clearHistory, mounted } = useWatchHistory();
  const [isOpen, setIsOpen] = useState(false);

  if (!mounted) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins}m lalu`;
    if (diffHours < 24) return `${diffHours}h lalu`;
    if (diffDays < 7) return `${diffDays}d lalu`;

    return date.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-white"
        title="Riwayat Tontonan"
      >
        <Clock className="w-4 h-4" />
        <span className="hidden sm:inline">Riwayat</span>
        <span className="sm:hidden text-xs">{items.length}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-1rem)] bg-[#1a2245]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-fade-up">
          <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-[#1a2245]/95">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#7b61ff]" />
              <h3 className="font-bold text-white">Riwayat Tontonan</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 group"
              >
                <Link
                  href={item.url}
                  onClick={() => setIsOpen(false)}
                  className="relative w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 group-hover:ring-2 ring-[#7b61ff]/50 transition-all"
                >
                  <img
                    src={optimizeThumb(item.image)}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    href={item.url}
                    onClick={() => setIsOpen(false)}
                    className="block font-medium text-sm text-white hover:text-[#7b61ff] transition-colors line-clamp-2"
                  >
                    {item.title}
                  </Link>
                  <p className="text-xs text-white/50 mt-1">{formatTime(item.timestamp)}</p>
                  <span className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded inline-block mt-1">
                    {item.platform}
                  </span>
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-white/60"
                  title="Hapus dari riwayat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="p-3 border-t border-white/10 flex items-center justify-between gap-2 bg-white/5">
              <span className="text-xs text-white/60">{items.length} item</span>
              <button
                onClick={() => {
                  clearHistory();
                  setIsOpen(false);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors text-white/60"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Semua
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
