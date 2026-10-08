"use client";
import {useQuickPlayHome,type QuickPlayPlatform} from "@/hooks/useQuickPlay";
import {DramaSection} from "@/components/DramaSection";
export function QuickPlayHome({platform,name}:{platform:QuickPlayPlatform;name:string}){
 const q=useQuickPlayHome(platform);
 return <DramaSection title={name} dramas={q.data} platform={platform} isLoading={q.isLoading} error={!!q.error} onRetry={()=>q.refetch()}/>;
}