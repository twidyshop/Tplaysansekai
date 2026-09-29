"use client";

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
import { TrendingBanner } from "@/components/TrendingBanner";
import { PlatformSelector } from "@/components/PlatformSelector";
import type { TrendingBannerItem } from "@/components/TrendingBanner";

export default function HomeContent() {
  const { isPineDrama, isDramaBox, isReelShort, isShortMax, isNetShort, isMelolo, isFreeReels, isDramaNova, isGoodShort, isFlickReels } = usePlatform();

  // Fetch data for all DramaBox sections
  const { data: latestDramas, isLoading: loadingLatest, error: errorLatest, refetch: refetchLatest } = useLatestDramas();
  const { data: trendingDramas, isLoading: loadingTrending, error: errorTrending, refetch: refetchTrending } = useTrendingDramas();
  const { data: dubindoDramas, isLoading: loadingDubindo, error: errorDubindo, refetch: refetchDubindo } = useDubindoDramas();

  // Convert trending dramas to banner format
  const trendingBanners: TrendingBannerItem[] = trendingDramas?.slice(0, 5).map((drama) => ({
    id: drama.book_id,
    title: drama.book_name,
    image: drama.cover_pic,
    description: drama.introduction,
    tags: drama.book_theme?.slice(0, 3),
    url: `/detail/dramabox/${drama.book_id}`,
    badge: "#1 Trending",
    playable: true,
  })) || [];

  return (
    <main className="min-h-screen pt-16">
      {/* PineDrama Content */}
      {isPineDrama && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PineDramaHome />
        </div>
      )}

      {/* DramaBox Content - With Banner and Platform Selector */}
      {isDramaBox && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          {/* Trending Banner */}
          {trendingBanners.length > 0 && (
            <TrendingBanner items={trendingBanners} autoPlayInterval={5000} />
          )}

          {/* Platform Selector */}
          <PlatformSelector />

          {/* Content Sections */}
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

          {/* Infinite Scroll Section */}
          <InfiniteDramaSection title="Lainnya" />
        </div>
      )}

      {/* ReelShort Content */}
      {isReelShort && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PlatformSelector />
          <ReelShortSection />
        </div>
      )}

      {/* ShortMax Content */}
      {isShortMax && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PlatformSelector />
          <ShortMaxHome />
        </div>
      )}

      {/* NetShort Content */}
      {isNetShort && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PlatformSelector />
          <NetShortHome />
        </div>
      )}

      {/* Melolo Content */}
      {isMelolo && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PlatformSelector />
          <MeloloHome />
        </div>
      )}

      {/* FreeReels Content */}
      {isFreeReels && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PlatformSelector />
          <FreeReelsHome />
        </div>
      )}

      {/* DramaNova Content */}
      {isDramaNova && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PlatformSelector />
          <DramaNovaHome />
        </div>
      )}

      {/* GoodShort Content */}
      {isGoodShort && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PlatformSelector />
          <GoodShortHome />
        </div>
      )}

      {/* FlickReels Content */}
      {isFlickReels && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PlatformSelector />
          <FlickReelsHome />
        </div>
      )}
    </main>
  );
}
