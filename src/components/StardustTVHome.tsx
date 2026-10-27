"use client";

import { useStardustTVHome } from "@/hooks/useStardustTV";
import { DramaSection } from "@/components/DramaSection";
import type { Drama } from "@/types/drama";

export function StardustTVHome() {
  const {
    data: dramas,
    isLoading,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useStardustTVHome();

  const categoryGroups = (() => {
    const groups = new Map<string, Drama[]>();
    for (const drama of dramas || []) {
      const tags = [...new Set([...(drama.tags || []), ...(drama.tagNames || [])])];
      for (const tag of tags) {
        const name = String(tag || "").trim();
        if (!name || name.length > 32) continue;
        const group = groups.get(name) || [];
        if (!group.some((item) => item.bookId === drama.bookId)) group.push(drama);
        groups.set(name, group);
      }
    }
    return [...groups.entries()]
      .filter(([, items]) => items.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);
  })();

  return (
    <div className="space-y-8">
      <DramaSection
        title="Katalog StardustTV"
        dramas={dramas}
        platform="stardusttv"
        isLoading={isLoading}
        error={Boolean(error)}
        onRetry={() => refetch()}
        hasMore={Boolean(hasNextPage)}
        isLoadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
      />
      {categoryGroups.map(([category, items]) => (
        <DramaSection
          key={category}
          title={category}
          dramas={items}
          platform="stardusttv"
          isLoading={isLoading}
          error={false}
          onRetry={() => refetch()}
        />
      ))}
    </div>
  );
}
