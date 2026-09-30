"use client";

import { TrendingBanner } from "@/components/TrendingBanner";
import { PlatformSelector } from "@/components/PlatformSelector";
import { DramaSection } from "@/components/DramaSection";
import { ReelShortSection } from "@/components/ReelShortSection";
import { ShortMaxHome } from "@/components/ShortMaxHome";
import { NetShortHome } from "@/components/NetShortHome";
import { MeloloHome } from "@/components/MeloloHome";
import { FreeReelsHome } from "@/components/FreeReelsHome";
import { DramaNovaHome } from "@/components/DramaNovaHome";
import { GoodShortHome } from "@/components/GoodShortHome";
import { FlickReelsHome } from "@/components/FlickReelsHome";
import { PineDramaHome } from "@/components/PineDramaHome";
import { useLatestDramas, useTrendingDramas, useDubindoDramas } from "@/hooks/useDramas";
import { usePlatform } from "@/hooks/usePlatform";
import { InfiniteDramaSection } from "@/components/InfiniteDramaSection";
import type { TrendingBannerItem } from "@/components/TrendingBanner";

export default function HomeContent() {
  const { isPineDrama, isDramaBox, isReelShort, isShortMax, isNetShort, isMelolo, isFreeReels, isDramaNova, isGoodShort, isFlickReels } = usePlatform();

  const { data: latestDramas, isLoading: loadingLatest, error: errorLatest, refetch: refetchLatest } = useLatestDramas();
  const { data: trendingDramas, isLoading: loadingTrending, error: errorTrending, refetch: refetchTrending } = useTrendingDramas();
  const { data: dubindoDramas, isLoading: loadingDubindo, error: errorDubindo, refetch: refetchDubindo } = useDubindoDramas();

  const trendingBanners: TrendingBannerItem[] =
    trendingDramas?.slice(0, 5).map((drama) => ({
      id: drama.bookId,
      title: drama.book_name,
      image: drama.cover_pic,
      description: drama.introduction,
      tags: drama.book_theme?.slice(0, 3),
      url: `/detail/dramabox/${drama.bookId}`,
      badge: "#1 Trending",
      playable: true,
    })) || [];

  return (
    <main className="min-h-screen pt-20">
      {isPineDrama && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PineDramaHome />
        </div>
      )}

      {isDramaBox && (
        <div className="container mx-auto px-4 py-8 space-y-10">
          {trendingBanners.length > 0 && <TrendingBanner items={trendingBanners} autoPlayInterval={5000} />}
          <PlatformSelector />

          <DramaSection
            title="Terbaru"
            dramas={latestDramas}
            isLoading={loadingLatest}
            error={!!errorLatest}
            onRetry={() => refetchLatest()}
          />
          <DramaSection
            title="Terpopuler"
            dramas={trendingDramas}
            isLoading={loadingTrending}
            error={!!errorTrending}
            onRetry={() => refetchTrending()}
          />
          <DramaSection
            title="Dubindo"
            dramas={dubindoDramas}
            isLoading={loadingDubindo}
            error={!!errorDubindo}
            onRetry={() => refetchDubindo()}
          />

          <InfiniteDramaSection title="Lainnya" />
        </div>
      )}

      {isReelShort && (
        <div className="container mx-auto px-4 py-8 space-y-10">
          <PlatformSelector />
          <ReelShortSection />
        </div>
      )}

      {isShortMax && (
        <div className="container mx-auto px-4 py-8 space-y-10">
          <PlatformSelector />
          <ShortMaxHome />
        </div>
      )}

      {isNetShort && (
        <div className="container mx-auto px-4 py-8 space-y-10">
          <PlatformSelector />
          <NetShortHome />
        </div>
      )}

      {isMelolo && (
        <div className="container mx-auto px-4 py-8 space-y-10">
          <PlatformSelector />
          <MeloloHome />
        </div>
      )}

      {isFreeReels && (
        <div className="container mx-auto px-4 py-8 space-y-10">
          <PlatformSelector />
          <FreeReelsHome />
        </div>
      )}

      {isDramaNova && (
        <div className="container mx-auto px-4 py-8 space-y-10">
          <PlatformSelector />
          <DramaNovaHome />
        </div>
      )}

      {isGoodShort && (
        <div className="container mx-auto px-4 py-8 space-y-10">
          <PlatformSelector />
          <GoodShortHome />
        </div>
      )}

      {isFlickReels && (
        <div className="container mx-auto px-4 py-8 space-y-10">
          <PlatformSelector />
          <FlickReelsHome />
        </div>
      )}
    </main>
  );
}
