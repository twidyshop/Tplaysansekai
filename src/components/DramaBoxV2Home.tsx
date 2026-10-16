"use client";

import { useState } from "react";
import { DramaSection } from "@/components/DramaSection";
import { useDramaBoxV2Home, type DramaBoxV2Feed } from "@/hooks/useDramaBoxV2";

const feeds: { id: DramaBoxV2Feed; label: string; title: string }[] = [
  { id: "trending", label: "Terpopuler", title: "Terpopuler" },
  { id: "latest", label: "Terbaru", title: "Terbaru" },
  { id: "hotrank", label: "Ranking", title: "Ranking" },
  { id: "recommended", label: "Rekomendasi", title: "Rekomendasi" },
  { id: "foryou", label: "Untukmu", title: "Untukmu" },
  { id: "browse", label: "Jelajahi", title: "Jelajahi" },
];

export function DramaBoxV2Home() {
  const [activeFeed, setActiveFeed] = useState<DramaBoxV2Feed>("trending");
  const query = useDramaBoxV2Home(activeFeed);
  const active = feeds.find((feed) => feed.id === activeFeed) ?? feeds[0];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Kategori DramaBox V2">
        {feeds.map((feed) => (
          <button
            key={feed.id}
            type="button"
            role="tab"
            aria-selected={activeFeed === feed.id}
            onClick={() => setActiveFeed(feed.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              activeFeed === feed.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/15 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            }`}
          >
            {feed.label}
          </button>
        ))}
      </div>
      <DramaSection
        title={`DramaBox V2 — ${active.title}`}
        dramas={query.data}
        platform="dramaboxv2"
        isLoading={query.isLoading}
        error={Boolean(query.error)}
        onRetry={() => query.refetch()}
        hasMore={Boolean(query.hasNextPage)}
        isLoadingMore={query.isFetchingNextPage}
        onLoadMore={() => query.fetchNextPage()}
      />
    </div>
  );
}
