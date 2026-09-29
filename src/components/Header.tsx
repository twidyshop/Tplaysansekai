"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Search, X, Play } from "lucide-react";
import { useSearchDramas } from "@/hooks/useDramas";
import { useReelShortSearch } from "@/hooks/useReelShort";
import { useNetShortSearch } from "@/hooks/useNetShort";
import { useShortMaxSearch } from "@/hooks/useShortMax";
import { useMeloloSearch } from "@/hooks/useMelolo";
import { useFreeReelsSearch } from "@/hooks/useFreeReels";
import { useDramaNovaSearch } from "@/hooks/useDramaNova";
import { useGoodShortSearch } from "@/hooks/useGoodShort";
import { usePineDramaSearch } from "@/hooks/usePineDrama";
import { useFlickReelsSearch } from "@/hooks/useFlickReels";
import { usePlatform } from "@/hooks/usePlatform";
import { useDebounce } from "@/hooks/useDebounce";
import { usePathname } from "next/navigation";
import { optimizeThumb } from "@/lib/image-utils";
import { WatchHistory } from "./WatchHistory";

export function Header() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformModalOpen, setPlatformModalOpen] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const normalizedQuery = debouncedQuery.trim();

  const { isPineDrama, isDramaBox, isReelShort, isShortMax, isNetShort, isMelolo, isFreeReels, isDramaNova, isGoodShort, isFlickReels, platformInfo, platforms, setPlatform } = usePlatform();

  const { data: dramaBoxResults, isLoading: isSearchingDramaBox } = useSearchDramas(isDramaBox ? normalizedQuery : "");
  const { data: reelShortResults, isLoading: isSearchingReelShort } = useReelShortSearch(isReelShort ? normalizedQuery : "");
  const { data: netShortResults, isLoading: isSearchingNetShort } = useNetShortSearch(isNetShort ? normalizedQuery : "");
  const { data: shortMaxResults, isLoading: isSearchingShortMax } = useShortMaxSearch(isShortMax ? normalizedQuery : "");
  const { data: meloloResults, isLoading: isSearchingMelolo } = useMeloloSearch(isMelolo ? normalizedQuery : "");
  const { data: freeReelsResults, isLoading: isSearchingFreeReels } = useFreeReelsSearch(isFreeReels ? normalizedQuery : "");
  const { data: dramaNovaResults, isLoading: isSearchingDramaNova } = useDramaNovaSearch(isDramaNova ? normalizedQuery : "");
  const { data: goodShortResults, isLoading: isSearchingGoodShort } = useGoodShortSearch(isGoodShort ? normalizedQuery : "");
  const { data: pineDramaResults, isLoading: isSearchingPineDrama } = usePineDramaSearch(isPineDrama ? normalizedQuery : "");
  const { data: flickReelsResults, isLoading: isSearchingFlickReels } = useFlickReelsSearch(isFlickReels ? normalizedQuery : "");

  const isSearching = isPineDrama ? isSearchingPineDrama : isDramaBox ? isSearchingDramaBox : isReelShort ? isSearchingReelShort : isShortMax ? isSearchingShortMax : isNetShort ? isSearchingNetShort : isMelolo ? isSearchingMelolo : isFreeReels ? isSearchingFreeReels : isDramaNova ? isSearchingDramaNova : isGoodShort ? isSearchingGoodShort : isFlickReels ? isSearchingFlickReels : false;
  const searchResults = isPineDrama ? pineDramaResults : isDramaBox ? dramaBoxResults : isReelShort ? reelShortResults?.data : isShortMax ? shortMaxResults?.data : isNetShort ? netShortResults?.data : isMelolo ? meloloResults?.data : isFreeReels ? freeReelsResults?.data : isDramaNova ? dramaNovaResults?.data : isGoodShort ? goodShortResults?.data : isFlickReels ? flickReelsResults?.data : [];

  const handleSearchClose = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  if (pathname?.startsWith("/watch")) {
    return null;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="font-display font-bold text-xl gradient-text">
              TPLAY+
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <WatchHistory />

            <button
              onClick={() => setPlatformModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted/80 transition-colors border border-border/50"
            >
              <div className="relative w-5 h-5 rounded-md overflow-hidden flex-shrink-0">
                <Image
                  src={platformInfo.logo}
                  alt={platformInfo.name}
                  fill
                  className="object-cover"
                  sizes="20px"
                />
              </div>
              <span className="font-medium text-xs sm:text-sm text-foreground whitespace-nowrap">
                {platformInfo.name}
              </span>
            </button>

            <button
              onClick={() => setSearchOpen(true)}
              className="p-2.5 rounded-xl hover:bg-muted/50 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {searchOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-background z-[9999] overflow-hidden">
            <div className="container mx-auto px-4 py-6 h-[100dvh] flex flex-col">
              <div className="flex items-center gap-4 mb-6 flex-shrink-0">
                <div className="flex-1 relative min-w-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Cari drama di ${platformInfo.name}...`}
                    className="search-input pl-12"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSearchClose}
                  className="p-3 rounded-xl hover:bg-muted/50 transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Mencari di:</span>
                <span className="px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">
                  {platformInfo.name}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                {isSearching && normalizedQuery && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {searchResults && searchResults.length === 0 && normalizedQuery && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Tidak ada hasil untuk "{normalizedQuery}" di {platformInfo.name}</p>
                  </div>
                )}

                {!normalizedQuery && (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">Ketik untuk mencari drama di {platformInfo.name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {platformModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setPlatformModalOpen(false)}>
            <div
              className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg max-h-[80vh] overflow-y-auto animate-fade-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
                <h2 className="font-display font-bold text-lg text-foreground">Pilih Platform</h2>
                <button
                  onClick={() => setPlatformModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => {
                        setPlatform(platform.id);
                        setPlatformModalOpen(false);
                      }}
                      className={`
                        flex flex-col items-center gap-2 p-3 rounded-xl transition-all
                        ${platformInfo.id === platform.id
                          ? "bg-primary/15 ring-2 ring-primary shadow-md"
                          : "hover:bg-muted/50"
                        }
                      `}
                    >
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm bg-muted/30">
                        <Image
                          src={platform.logo}
                          alt={platform.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <span className={`text-xs font-medium text-center leading-tight line-clamp-1 ${
                        platformInfo.id === platform.id ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {platform.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{platforms.length} platform tersedia</span>
                <div className="flex items-center gap-2">
                  <div className="relative w-5 h-5 rounded-md overflow-hidden">
                    <Image
                      src={platformInfo.logo}
                      alt={platformInfo.name}
                      fill
                      className="object-cover"
                      sizes="20px"
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">{platformInfo.name}</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
