"use client";

import { useStardustTVHome } from "@/hooks/useStardustTV";
import { DramaSection } from "@/components/DramaSection";

export function StardustTVHome() {
  const {
    data: dramas,
    isLoading,
    error,
    refetch,
  } = useStardustTVHome();

  return (
    <DramaSection
      title="StardustTV"
      dramas={dramas}
      platform="stardusttv"
      isLoading={isLoading}
      error={Boolean(error)}
      onRetry={() => refetch()}
    />
  );
}
