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
      className="relative w-full aspect-video md:aspect-[3/1] rounded-2xl overflow-hidden group bg-muted/50"
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
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

        {/* Badge */}
        {currentItem.badge && (
          <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {currentItem.badge}
          </div>
        )}

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 line-clamp-2">
            {currentItem.title}
          </h2>

          {currentItem.description && (
            <p className="text-sm sm:text-base text-white/80 mb-4 line-clamp-2">
              {currentItem.description}
            </p>
          )}

          {currentItem.tags && currentItem.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {currentItem.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded-full text-xs bg-white/20 text-white backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {currentItem.playable !== false && (
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors w-fit">
              <Play className="w-4 h-4 fill-current" />
              Tonton
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
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              nextSlide();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {items.length > 1 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-10">
          {items.slice(0, 10).map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.preventDefault();
                setCurrentIndex(idx);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                idx === currentIndex ? "bg-primary w-6" : "bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
