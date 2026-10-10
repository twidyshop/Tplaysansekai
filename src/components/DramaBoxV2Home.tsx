"use client";
import { DramaSection } from "@/components/DramaSection";
import { useDramaBoxV2Home } from "@/hooks/useDramaBoxV2";

export function DramaBoxV2Home() {
  const query = useDramaBoxV2Home();
  return <DramaSection title="DramaBox V2 — Terpopuler" dramas={query.data} platform="dramaboxv2" isLoading={query.isLoading} error={Boolean(query.error)} onRetry={() => query.refetch()} hasMore={Boolean(query.hasNextPage)} isLoadingMore={query.isFetchingNextPage} onLoadMore={() => query.fetchNextPage()} />;
}
