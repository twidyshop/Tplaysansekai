"use client";

import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";

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
import { MeloShortHome } from "@/components/MeloShortHome";
import { InfiniteDramaSection } from "@/components/InfiniteDramaSection";
import { PlatformSelector } from "@/components/PlatformSelector";

import { useLatestDramas, useTrendingDramas, useDubindoDramas } from "@/hooks/useDramas";
import { usePlatform } from "@/hooks/usePlatform";

// Interface untuk memastikan TypeScript bahagia dan tidak error
interface TrendingBannerItem {
  id: string;
  title: string;
  image: string;
  description: string;
  tags: string[];
  url: string;
  badge: string;
  playable: boolean;
}

export default function HomeContent() {
  const { 
    isMeloShort, isPineDrama, isDramaBox, isReelShort, isShortMax, isNetShort, 
    isMelolo, isFreeReels, isDramaNova, isGoodShort, isFlickReels 
  } = usePlatform();

  const { data: latestDramas, isLoading: loadingLatest, error: errorLatest, refetch: refetchLatest } = useLatestDramas();
  const { data: trendingDramas, isLoading: loadingTrending, error: errorTrending, refetch: refetchTrending } = useTrendingDramas();
  const { data: dubindoDramas, isLoading: loadingDubindo, error: errorDubindo, refetch: refetchDubindo } = useDubindoDramas();

  // MAPPING DATA SUPER AMAN: 
  // Menggunakan 'any' pada argumen agar TypeScript tidak protes soal snake_case vs camelCase.
  // Semua nilai diakhiri dengan '|| ""' agar dipastikan selalu string dan bukan undefined.
  const trendingBanners: TrendingBannerItem[] = (trendingDramas || [])
    .slice(0, 5)
    .map((drama: any) => ({
      id: String(drama.bookId || drama.book_id || ''),
      title: drama.bookName || drama.book_name || drama.book_title || 'Untitled',
      image: drama.coverWap || drama.cover || drama.book_pic || drama.cover_pic || '',
      description: drama.introduction || '',
      tags: drama.tags || drama.tagNames || drama.book_theme || [],
      url: `/detail/dramabox/${drama.bookId || drama.book_id || ''}`,
      badge: 'Trending',
      playable: true,
    }));

  // Mengambil 1 drama paling trending untuk dijadikan Banner Hero Utama
  const heroBanner = trendingBanners.length > 0 ? trendingBanners[0] : null;

  return (
    <main className="min-h-screen pt-16 pb-20">
      
      {/* === HERO BANNER SECTION (Diperbaiki agar rapi & tidak kepotong di HP) === */}
      {!loadingTrending && heroBanner && heroBanner.image && (
        <div className="w-full relative h-[55vh] md:h-[65vh] lg:h-[70vh] bg-black overflow-hidden">
          {/* Background Image Banner */}
          <div className="absolute inset-0">
            <Image
              src={heroBanner.image}
              alt={heroBanner.title}
              fill
              className="object-cover object-top opacity-55 scale-105 transform transition-transform duration-1000"
              priority
            />
            {/* Efek gradien berlapis agar teks sangat kontras dan bersih */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e27] via-[#0a0e27]/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e27] via-[#0a0e27]/40 to-transparent" />
          </div>

          {/* Konten Teks Banner */}
          <div className="container mx-auto px-4 h-full relative flex items-end pb-8 md:pb-12">
            <div className="max-w-2xl space-y-2 md:space-y-4">
              {heroBanner.badge && (
                <span className="inline-block px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold bg-primary text-primary-foreground rounded-full shadow-md">
                  {heroBanner.badge}
                </span>
              )}
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white drop-shadow-md line-clamp-2 leading-tight">
                {heroBanner.title}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-200 line-clamp-2 md:line-clamp-3 drop-shadow-sm font-normal">
                {heroBanner.description}
              </p>
              
              {/* Tags/Genre Banner */}
              {heroBanner.tags && heroBanner.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {heroBanner.tags.slice(0, 3).map((tag: any, idx: number) => {
                    const tagText = typeof tag === 'string' ? tag : tag.tagName || '';
                    if (!tagText) return null;
                    return (
                      <span key={idx} className="px-2 py-0.5 text-[10px] md:text-xs bg-white/15 backdrop-blur-md rounded-md text-white/90 border border-white/10">
                        {tagText}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Tombol Nonton Banner */}
              <div className="pt-2 md:pt-3">
                <Link
                  href={heroBanner.url}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 md:px-6 py-2.5 md:py-3 rounded-full text-sm md:text-base font-semibold shadow-lg transition-all transform active:scale-95"
                >
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                  Mulai Nonton
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === PLATFORM SELECTOR SECTION === */}
      {/* Efek sticky top-16 menyesuaikan tinggi header Anda agar menempel rapi saat discroll */}
      <div className="sticky top-16 z-40 bg-[#0a0e27]/90 backdrop-blur-xl border-b border-white/10 shadow-lg">
        <div className="container mx-auto">
          <PlatformSelector />
        </div>
      </div>

      {/* === KONTEN DINAMIS BERDASARKAN PLATFORM === */}
      {isMeloShort && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <MeloShortHome />
        </div>
      )}

      {isPineDrama && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <PineDramaHome />
        </div>
      )}

      {isDramaBox && (
        <div className="container mx-auto px-4 py-6 space-y-8">
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
        <div className="container mx-auto px-4 py-6 space-y-8">
          <ReelShortSection />
        </div>
      )}

      {isShortMax && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <ShortMaxHome />
        </div>
      )}

      {isNetShort && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <NetShortHome />
        </div>
      )}

      {isMelolo && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <MeloloHome />
        </div>
      )}

      {isFreeReels && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <FreeReelsHome />
        </div>
      )}

      {isDramaNova && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <DramaNovaHome />
        </div>
      )}

      {isGoodShort && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <GoodShortHome />
        </div>
      )}

      {isFlickReels && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <FlickReelsHome />
        </div>
      )}
    </main>
  );
}
