"use client";

import { useMeloShortDramas } from "@/hooks/useMeloShort";
import { DramaSection } from "@/components/DramaSection";

export function MeloShortHome() {
  const { data: dramas, isLoading, error, refetch } = useMeloShortDramas();

  return (
    <DramaSection
      title="MeloShort"
      dramas={dramas}
      isLoading={isLoading}
      error={!!error}
      onRetry={() => refetch()}
    />
  );
}
