"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSearchDramas, useIqiyiSearch } from "@/hooks/useDramas";
import { useWetvSearch } from "@/hooks/useWetv";
import { useDramaNovaSearch } from "@/hooks/useDramaNova";
import { useMoboReelsSearch } from "@/hooks/useMoboReels";
import { usePlatform } from "@/hooks/usePlatform";
import { DramaCard } from "@/components/DramaCard";
import type { Drama } from "@/types/drama";

function SearchResults() {
  const searchParams=useSearchParams();
  const query=searchParams.get("q")||"";
  const {isIqiyi,isWetv,isDramaNova,isMoboReels}=usePlatform();
  const dramaSearch=useSearchDramas(query);
  const iqiyiSearch=useIqiyiSearch(query);
  const wetvSearch=useWetvSearch(query);
  const dramaNovaSearch=useDramaNovaSearch(query);
  const moboReelsSearch=useMoboReelsSearch(query);
  const searchResults=isIqiyi?iqiyiSearch.data:isWetv?wetvSearch.data:isDramaNova?dramaNovaSearch.data:isMoboReels?moboReelsSearch.data:dramaSearch.data;
  const isLoading=isIqiyi?iqiyiSearch.isLoading:isWetv?wetvSearch.isLoading:isDramaNova?dramaNovaSearch.isLoading:isMoboReels?moboReelsSearch.isLoading:dramaSearch.isLoading;
  const error=isIqiyi?iqiyiSearch.error:isWetv?wetvSearch.error:isDramaNova?dramaNovaSearch.error:isMoboReels?moboReelsSearch.error:dramaSearch.error;

  return <div className="container mx-auto px-4">
    <h1 className="mb-6 text-xl font-bold text-white sm:text-2xl">Hasil Pencarian untuk: <span className="text-primary">"{query}"</span></h1>
    {!query?<div className="flex justify-center py-20 text-white/60">Silakan masukkan kata kunci pencarian.</div>
    :isLoading?<div className="flex flex-col items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"/><p className="mt-4 text-white/60">Mencari drama...</p></div>
    :error?<div className="flex justify-center py-20 text-red-400">Terjadi kesalahan saat mencari drama.</div>
    :searchResults&&searchResults.length>0?<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6">
      {searchResults.map((result:any,index:number)=>{
        if(isDramaNova || isMoboReels){
          const id=String(result.dramaId||result.id||result.bookId||result.videoId||index);
          const title=result.title||result.name||result.bookName||result.albumName||"Untitled";
          const cover=result.posterImgUrl||result.posterImg||result.cover||result.poster||result.image||result.thumbnail||result.coverUrl||"";
          const platform=isDramaNova?"dramanova":"moboreels";
          return <a key={id+"-"+platform} href={"/detail/"+platform+"/"+encodeURIComponent(id)+"?title="+encodeURIComponent(title)+"&cover="+encodeURIComponent(cover)} className="group min-w-0">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/5 bg-zinc-900">{cover?<img src={"/api/"+platform+"/image?url="+encodeURIComponent(cover)} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer"/>:<div className="flex h-full items-center justify-center text-xs text-white/30">No Image</div>}</div>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/90">{title}</h3>
          </a>;
        }
        if(isWetv){
          const id=String(result.id||result.bookId||result.contentId||result.videoId||index);
          const title=result.title||result.name||result.bookName||result.albumName||"Untitled";
          const cover=result.cover||result.poster||result.image||result.thumbnail||result.coverUrl||"";
          return <a key={id+"-wetv"} href={"/detail/wetv/"+encodeURIComponent(id)+"?title="+encodeURIComponent(title)+"&cover="+encodeURIComponent(cover)} className="group min-w-0">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/5 bg-zinc-900">{cover?<img src={"/api/wetv/image?url="+encodeURIComponent(cover)} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer"/>:<div className="flex h-full items-center justify-center text-xs text-white/30">No Image</div>}</div>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/90">{title}</h3>
          </a>;
        }
        const dramaMapped:Drama={bookId:String(result.bookId||result.id||index),bookName:result.bookName||result.book_title||result.title||result.name||"Untitled",cover:result.cover||result.book_pic||result.poster||result.image,chapterCount:Number(result.chapterCount||result.episodeCount||0),introduction:result.introduction||result.description||"",inLibrary:result.inLibrary||false};
        return <DramaCard key={dramaMapped.bookId+"-"+index} drama={dramaMapped} index={index} platform={isIqiyi?"iqiyi":"dramabox"}/>;
      })}
    </div>
    :<div className="flex justify-center py-20 text-white/60">Tidak ditemukan drama dengan judul "{query}".</div>}
  </div>;
}

export default function SearchPage(){
  return <main className="min-h-screen bg-[#0a0e27] pt-24 pb-12"><Suspense fallback={<div className="flex justify-center pt-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"/></div>}><SearchResults/></Suspense></main>;
}
