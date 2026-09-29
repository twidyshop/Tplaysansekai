"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { optimizeBanner } from "@/lib/image-utils";

export interface TrendingBannerItem {
  id: string;
  title: string;
  image: string;
  description?: string;
  tags?: string[];
  url: string;
  badge?: string;
  playable?: boolean;
  episodeCount?: string;
}

interface TrendingBannerProps {
  items: TrendingBannerItem[];
  autoPlayInterval?: number;
}

export function TrendingBanner({
  items,
  autoPlayInterval = 5000,
}: TrendingBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (isHovered || items.length <= 1) return;
    const interval = setInterval(nextSlide, autoPlayInterval);
    return () => clearInterval(interval);
  }, [isHovered, nextSlide, autoPlayInterval, items.length]);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <div
      className="relative w-full aspect-video md:aspect-[16/9] lg:aspect-[2/1] rounded-3xl overflow-hidden group bg-gradient-to-br from-[#1a2245] to-[#0d142d]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Banner Image */}
      <Link href={currentItem.url} className="w-full h-full block">
        <img
          src={optimizeBanner(currentItem.image)}
          alt={currentItem.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e27]/90 via-[#0a0e27]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e27]/80 via-transparent to-transparent" />

        {/* Badge */}
        {currentItem.badge && (
          <div className="absolute top-6 left-6 px-3 py-1.5 rounded-full bg-[#ff5db1] text-white text-xs font-black uppercase tracking-wider shadow-lg">
            {currentItem.badge}
          </div>
        )}

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 md:p-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3 line-clamp-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {currentItem.title}
          </h2>

          {currentItem.description && (
            <p className="text-sm sm:text-base text-white/80 mb-4 line-clamp-2">
              {currentItem.description}
            </p>
          )}

          {currentItem.tags && currentItem.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {currentItem.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-sm border border-white/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {currentItem.playable !== false && (
            <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#ff5db1] to-[#7b61ff] text-white text-sm font-bold hover:shadow-[0_0_20px_rgba(123,97,255,0.5)] transition-all duration-200 w-fit">
              <Play className="w-5 h-5 fill-current" />
              Mulai Nonton
            </button>
          )}
        </div>
      </Link>

      {/* Navigation Arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              prevSlide();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20 z-10"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              nextSlide();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20 z-10"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {items.length > 1 && (
        <div className="absolute bottom-6 right-6 flex items-center gap-2 z-10">
          {items.slice(0, 10).map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.preventDefault();
                setCurrentIndex(idx);
              }}
              className={`rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "bg-[#7b61ff] w-8 h-2"
                  : "bg-white/40 hover:bg-white/60 w-2 h-2"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
