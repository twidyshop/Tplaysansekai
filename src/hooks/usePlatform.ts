import { create } from "zustand";

export type Platform =
  | "meloshort"
  | "pinedrama"
  | "dramabox"
  | "reelshort"
  | "shortmax"
  | "netshort"
  | "melolo"
  | "freereels"
  | "flickreels"
  | "dramanova"
  | "goodshort"
  | string;

export const PLATFORMS = [
  {
    id: "meloshort",
    name: "MeloShort",
    logo: "/logos/pinedrama.png", // <- Sementara pakai logo pinedrama agar tidak blank
    apiBase: "/api/meloshort",
  },
  {
    id: "pinedrama",
    name: "PineDrama",
    logo: "/logos/pinedrama.png",
    apiBase: "/api/pinedrama",
  },
  {
    id: "dramabox",
    name: "DramaBox",
    logo: "/logos/dramabox.png",
    apiBase: "/api/dramabox",
  },
  {
    id: "reelshort",
    name: "ReelShort",
    logo: "/logos/reelshort.png",
    apiBase: "/api/reelshort",
  },
  {
    id: "shortmax",
    name: "ShortMax",
    logo: "/logos/shortmax.png",
    apiBase: "/api/shortmax",
  },
  {
    id: "netshort",
    name: "NetShort",
    logo: "/logos/netshort.png",
    apiBase: "/api/netshort",
  },
  {
    id: "melolo",
    name: "Melolo",
    logo: "/logos/melolo.png",
    apiBase: "/api/melolo",
  },
  {
    id: "freereels",
    name: "FreeReels",
    logo: "/logos/freereels.png",
    apiBase: "/api/freereels",
  },
  {
    id: "flickreels",
    name: "FlickReels",
    logo: "/logos/flickreels.png",
    apiBase: "/api/flickreels",
  },
];

interface PlatformState {
  currentPlatform: Platform;
  setPlatform: (platform: Platform) => void;
}

export const usePlatformStore = create<PlatformState>((set) => ({
  currentPlatform: "meloshort", 
  setPlatform: (platform) => set({ currentPlatform: platform }),
}));

export function usePlatform() {
  const { currentPlatform, setPlatform } = usePlatformStore();
  const platformInfo = PLATFORMS.find((p) => p.id === currentPlatform)!;

  const getPlatformInfo = (platformId: Platform) => {
    return PLATFORMS.find((p) => p.id === platformId) || PLATFORMS[0];
  };

  return {
    currentPlatform,
    platformInfo,
    setPlatform,
    platforms: PLATFORMS,
    getPlatformInfo,
    isMeloShort: currentPlatform === "meloshort",
    isPineDrama: currentPlatform === "pinedrama",
    isDramaBox: currentPlatform === "dramabox",
    isReelShort: currentPlatform === "reelshort",
    isShortMax: currentPlatform === "shortmax",
    isNetShort: currentPlatform === "netshort",
    isMelolo: currentPlatform === "melolo",
    isFreeReels: currentPlatform === "freereels",
    isDramaNova: currentPlatform === "dramanova",
    isGoodShort: currentPlatform === "goodshort",
    isFlickReels: currentPlatform === "flickreels",
  };
}
