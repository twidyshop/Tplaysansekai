"use client";

import { useStardustTVHome } from "@/hooks/useStardustTV";
import { DramaSection } from "@/components/DramaSection";

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

  return (
    <DramaSection
      title="StardustTV"
      dramas={dramas}
      platform="stardusttv"
      isLoading={isLoading}
      error={Boolean(error)}
      onRetry={() => refetch()}
      hasMore={Boolean(hasNextPage)}
      isLoadingMore={isFetchingNextPage}
      onLoadMore={() => fetchNextPage()}
    />
  );
}
