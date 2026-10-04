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
import { IqiyiHome } from "@/components/IqiyiHome";
import { WetvHome } from "@/components/WetvHome";
import { InfiniteDramaSection } from "@/components/InfiniteDramaSection";
import { PlatformSelector } from "@/components/PlatformSelector";
import { useLatestDramas, useTrendingDramas, useDubindoDramas } from "@/hooks/useDramas";
import { usePlatform } from "@/hooks/usePlatform";
import { useQuery } from "@tanstack/react-query";

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

function extractItems(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["data", "list", "rows", "results", "items", "books", "dramas", "albums"]) {
    if (Array.isArray(value[key])) return value[key];
    const nested = extractItems(value[key]);
    if (nested.length) return nested;
  }
  return [];
}

function pick(value: any, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const item = value?.[key];
    if (typeof item === "string" && item.trim()) return item.trim();
    if (typeof item === "number") return String(item);
  }
  return fallback;
}

function deepPick(value: any, keys: string[], fallback = "", depth = 0): string {
  if (depth > 8 || value == null) return fallback;
  const direct = pick(value, keys, "");
  if (direct) return direct;
  if (typeof value !== "object") return fallback;
  for (const key of Object.keys(value)) {
    const found = deepPick(value[key], keys, "", depth + 1);
    if (found) return found;
  }
  return fallback;
}

export default function HomeContent() {
  const {
    isMeloShort, isPineDrama, isDramaBox, isReelShort, isShortMax, isNetShort,
    isMelolo, isFreeReels, isDramaNova, isGoodShort, isFlickReels, isIqiyi, isWetv
  } = usePlatform();

  // DramaBox data is only queried when DramaBox is selected.
  const { data: latestDramas, isLoading: loadingLatest, error: errorLatest, refetch: refetchLatest } = useLatestDramas(isDramaBox);
  const { data: trendingDramas, isLoading: loadingTrending, error: errorTrending, refetch: refetchTrending } = useTrendingDramas(isDramaBox);
  const { data: dubindoDramas, isLoading: loadingDubindo, error: errorDubindo, refetch: refetchDubindo } = useDubindoDramas(isDramaBox);

  // Main hero uses iQIYI Trending. It is only requested when iQIYI is selected.
  const iqiyiTrending = useQuery({
    queryKey: ["iqiyi", "home", "banner"],
    queryFn: async () => {
      const response = await fetch("/api/iqiyi?action=home&lang=id");
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Gagal memuat iQIYI Trending");
      return extractItems(json);
    },
    enabled: isIqiyi,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const iqiyiBannerItems: TrendingBannerItem[] = (iqiyiTrending.data || [])
    .slice(0, 5)
    .map((item: any, index: number) => {
      const id = pick(item, ["id", "bookId", "dramaId", "videoId", "albumId"], String(index));
      const albumId = pick(item, ["albumId", "album_id", "albumID"], "");
      const title = pick(item, ["title", "name", "bookName", "albumName"], "Untitled");
      const image = pick(item, ["cover", "poster", "image", "thumbnail", "coverUrl", "pic", "albumPic"], "");
      const description = deepPick(item, ["description", "synopsis", "introduction", "intro", "desc", "summary", "shotDesc", "storyline", "plot", "content", "brief", "briefIntroduction", "shortDescription", "longDescription", "descriptionText", "descText", "synopsisText", "summaryText", "story", "storylineText", "contentDesc", "contentDescription"], "");
      const rawTags = item?.tags || item?.tagNames || item?.genres || [];
      const tags = Array.isArray(rawTags)
        ? rawTags.map((tag: any) => typeof tag === "string" ? tag : tag?.tagName || tag?.name || "").filter(Boolean)
        : [];

      const params = new URLSearchParams({
        title,
        cover: image,
        ...(albumId ? { albumId } : {}),
        ...(description ? { description } : {}),
      });

      return {
        id,
        title,
        image,
        description,
        tags,
        url: "/detail/iqiyi/" + encodeURIComponent(id) + "?" + params.toString(),
        badge: "Trending",
        playable: true,
      };
    });

  const heroBanner = iqiyiBannerItems.length > 0 ? iqiyiBannerItems[0] : null;

  return (
    <main className="min-h-screen pt-16 pb-20">
      {isIqiyi && !iqiyiTrending.isLoading && heroBanner && heroBanner.image && (
        <div className="w-full relative h-[55vh] md:h-[65vh] lg:h-[70vh] bg-black overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src={"/api/iqiyi/image?url=" + encodeURIComponent(heroBanner.image)}
              alt={heroBanner.title}
              fill
              className="object-cover object-top opacity-55 scale-105 transform transition-transform duration-1000"
              priority
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e27] via-[#0a0e27]/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e27] via-[#0a0e27]/40 to-transparent" />
          </div>
          <div className="container mx-auto px-4 h-full relative flex items-end pb-8 md:pb-12">
            <div className="max-w-2xl space-y-2 md:space-y-4">
              {heroBanner.badge && <span className="inline-block px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold bg-primary text-primary-foreground rounded-full shadow-md">{heroBanner.badge}</span>}
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white drop-shadow-md line-clamp-2 leading-tight">{heroBanner.title}</h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-200 line-clamp-2 md:line-clamp-3 drop-shadow-sm font-normal">{heroBanner.description}</p>
              {heroBanner.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {heroBanner.tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 text-[10px] md:text-xs bg-white/15 backdrop-blur-md rounded-md text-white/90 border border-white/10">{tag}</span>
                  ))}
                </div>
              )}
              <div className="pt-2 md:pt-3">
                <Link href={heroBanner.url} className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 md:px-6 py-2.5 md:py-3 rounded-full text-sm md:text-base font-semibold shadow-lg transition-all transform active:scale-95">
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" /> Mulai Nonton
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-16 z-40 bg-[#0a0e27]/90 backdrop-blur-xl border-b border-white/10 shadow-lg">
        <div className="container mx-auto"><PlatformSelector /></div>
      </div>

      {isIqiyi && <div className="container mx-auto px-4 py-6 space-y-8"><IqiyiHome /></div>}
      {isWetv && <div className="container mx-auto px-4 py-6 space-y-8"><WetvHome /></div>}

      {isMeloShort && <div className="container mx-auto px-4 py-6 space-y-8"><MeloShortHome /></div>}
      {isPineDrama && <div className="container mx-auto px-4 py-6 space-y-8"><PineDramaHome /></div>}

      {isDramaBox && (
        <div className="container mx-auto px-4 py-6 space-y-8">
          <DramaSection title="Terbaru" dramas={latestDramas} isLoading={loadingLatest} error={!!errorLatest} onRetry={() => refetchLatest()} />
          <DramaSection title="Terpopuler" dramas={trendingDramas} isLoading={loadingTrending} error={!!errorTrending} onRetry={() => refetchTrending()} />
          <DramaSection title="Dubindo" dramas={dubindoDramas} isLoading={loadingDubindo} error={!!errorDubindo} onRetry={() => refetchDubindo()} />
          <InfiniteDramaSection title="Lainnya" />
        </div>
      )}

      {isReelShort && <div className="container mx-auto px-4 py-6 space-y-8"><ReelShortSection /></div>}
      {isShortMax && <div className="container mx-auto px-4 py-6 space-y-8"><ShortMaxHome /></div>}
      {isNetShort && <div className="container mx-auto px-4 py-6 space-y-8"><NetShortHome /></div>}
      {isMelolo && <div className="container mx-auto px-4 py-6 space-y-8"><MeloloHome /></div>}
      {isFreeReels && <div className="container mx-auto px-4 py-6 space-y-8"><FreeReelsHome /></div>}
      {isDramaNova && <div className="container mx-auto px-4 py-6 space-y-8"><DramaNovaHome /></div>}
      {isGoodShort && <div className="container mx-auto px-4 py-6 space-y-8"><GoodShortHome /></div>}
      {isFlickReels && <div className="container mx-auto px-4 py-6 space-y-8"><FlickReelsHome /></div>}
    </main>
  );
}
