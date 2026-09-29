"use client";

import { DramaCard } from "./DramaCard";
import { DramaCardSkeleton } from "./DramaCardSkeleton";
import { AlertCircle, RotateCcw } from "lucide-react";
import type { Drama } from "@/types/drama";

interface DramaSectionProps {
  title: string;
  dramas: Drama[] | undefined;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function DramaSection({
  title,
  dramas,
  isLoading,
  error,
  onRetry,
}: DramaSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl md:text-3xl font-bold gradient-text">{title}</h2>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-destructive font-medium">Gagal memuat data</p>
          </div>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Coba Lagi
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {isLoading ? (
          <>
            {Array.from({ length: 10 }).map((_, i) => (
              <DramaCardSkeleton key={i} />
            ))}
          </>
        ) : dramas && dramas.length > 0 ? (
          dramas.map((drama) => (
            <DramaCard
              key={drama.book_id}
              drama={drama}
              platform="dramabox"
            />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">Tidak ada drama tersedia</p>
          </div>
        )}
      </div>
    </section>
  );
}
