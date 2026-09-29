"use client";

import { useState } from "react";
import { ChevronRight, X, Trash2, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { optimizeThumb } from "@/lib/image-utils";

export function WatchHistory() {
  const { items, removeItem, clearHistory, mounted } = useWatchHistory();
  const [isOpen, setIsOpen] = useState(false);

  if (!mounted || items.length === 0) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins}m yang lalu`;
    if (diffHours < 24) return `${diffHours}h yang lalu`;
    if (diffDays < 7) return `${diffDays}d yang lalu`;
    
    return date.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 hover:bg-muted/80 transition-colors border border-border/50 text-sm font-medium"
        title="Riwayat Tontonan"
      >
        <Clock className="w-4 h-4" />
        <span className="hidden sm:inline">Riwayat</span>
        <span className="sm:hidden">{items.length}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] bg-card rounded-xl shadow-2xl border border-border overflow-hidden z-50 animate-fade-up">
          <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="font-display font-bold text-foreground">Riwayat Tontonan</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0 group"
              >
                <Link
                  href={item.url}
                  onClick={() => setIsOpen(false)}
                  className="relative w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 group-hover:ring-2 ring-primary/50 transition-all"
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
                    className="block font-medium text-sm text-foreground hover:text-primary transition-colors line-clamp-2"
                  >
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(item.timestamp)}
                  </p>
                  <span className="text-xs bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded inline-block mt-1">
                    {item.platform}
                  </span>
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 rounded-lg hover:bg-destructive/20 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  title="Hapus dari riwayat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="p-3 border-t border-border flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {items.length} item
              </span>
              <button
                onClick={() => {
                  clearHistory();
                  setIsOpen(false);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg hover:bg-destructive/20 hover:text-destructive transition-colors text-muted-foreground"
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
