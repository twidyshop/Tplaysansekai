"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold text-white mb-6">
        Hasil Pencarian untuk: <span className="text-primary">"{query}"</span>
      </h1>
      
      {query ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-white/60 mb-4">
            Fitur pemanggilan API pencarian ke server sedang disiapkan.
          </p>
          <p className="text-sm text-white/40">
            (Nanti di sini kita akan me-looping komponen DramaCard berdasarkan kata kunci "{query}")
          </p>
        </div>
      ) : (
        <div className="text-white/60">Silakan masukkan kata kunci pencarian.</div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <main className="min-h-screen pt-24 pb-12 bg-[#0a0e27]">
      {/* Suspense wajib digunakan di Next.js saat memakai useSearchParams */}
      <Suspense fallback={<div className="text-white text-center pt-20">Memuat pencarian...</div>}>
        <SearchResults />
      </Suspense>
    </main>
  );
}
