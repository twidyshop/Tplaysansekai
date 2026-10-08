"use client";

import { DramaCard } from "./DramaCard";
import { DramaCardSkeleton } from "./DramaCardSkeleton";
import { AlertCircle, RotateCcw } from "lucide-react";
import type { Drama } from "@/types/drama";

interface DramaSectionProps {
  title: string;
  dramas: Drama[] | undefined;
  platform?: "dramabox" | "meloshort" | "stardusttv";
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function DramaSection({
  title,
  dramas,
  platform = "dramabox",
  isLoading,
  error,
  onRetry,
}: DramaSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold gradient-text md:text-3xl">
          {title}
        </h2>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />

          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              Gagal memuat data
            </p>
          </div>

          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 rounded-lg bg-destructive/20 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/30"
          >
            <RotateCcw className="h-4 w-4" />
            Coba Lagi
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
        {isLoading ? (
          <>
            {Array.from({ length: 10 }).map((_, index) => (
              <DramaCardSkeleton key={index} />
            ))}
          </>
        ) : dramas && dramas.length > 0 ? (
          dramas.map((drama) => (
            <DramaCard
              key={drama.bookId}
              drama={drama}
              platform={platform}
            />
          ))
        ) : (
          <div className="col-span-full py-12 text-center">
            <p className="text-muted-foreground">
              Tidak ada drama tersedia
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
