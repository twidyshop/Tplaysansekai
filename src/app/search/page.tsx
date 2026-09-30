"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSearchDramas } from "@/hooks/useDramas";
import { DramaCard } from "@/components/DramaCard";
import type { Drama } from "@/types/drama";

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  // Memanggil hook pencarian
  const { data: searchResults, isLoading, error } = useSearchDramas(query);

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">
        Hasil Pencarian untuk: <span className="text-primary">"{query}"</span>
      </h1>
      
      {!query ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-white/60">Silakan masukkan kata kunci pencarian.</p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-white/60">Mencari drama...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-red-400">Terjadi kesalahan saat mencari drama.</p>
        </div>
      ) : searchResults && searchResults.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
          {searchResults.map((result: any, index: number) => {
            // Mapping SearchResult ke format Drama agar kompatibel dengan DramaCard
            const dramaMapped: Drama = {
              bookId: result.bookId,
              bookName: result.bookName || result.book_title,
              cover: result.cover || result.book_pic,
              chapterCount: 0, // Fallback jika tidak ada di SearchResult
              introduction: result.introduction || "",
              inLibrary: result.inLibrary || false,
            };

            return (
              <DramaCard 
                key={result.bookId || index} 
                drama={dramaMapped} 
                index={index} 
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-white/60">Tidak ditemukan drama dengan judul "{query}".</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <main className="min-h-screen pt-24 pb-12 bg-[#0a0e27]">
      <Suspense fallback={
        <div className="flex justify-center pt-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      }>
        <SearchResults />
      </Suspense>
    </main>
  );
}
