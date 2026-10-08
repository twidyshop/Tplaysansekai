import { create } from "zustand";

export type Platform =
  | "stardusttv"
  | "iqiyi"
  | "wetv"
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
    id: "stardusttv",
    name: "StardustTV",
    logo: "/stardusttv.svg",
    apiBase: "/api/stardusttv",
  },
  { id: "iqiyi", name: "iQIYI", logo: "/iqiyi.svg", apiBase: "/api/iqiyi" },
  { id: "wetv", name: "WeTV", logo: "/wetv.svg", apiBase: "/api/wetv" },
  { id: "meloshort", name: "MeloShort", logo: "/meloshort.png", apiBase: "/api/meloshort" },
  { id: "pinedrama", name: "PineDrama", logo: "/pinedrama.png", apiBase: "/api/pinedrama" },
  { id: "dramabox", name: "DramaBox", logo: "/dramabox.webp", apiBase: "/api/dramabox" },
  { id: "reelshort", name: "ReelShort", logo: "/reelshort.webp", apiBase: "/api/reelshort" },
  { id: "shortmax", name: "ShortMax", logo: "/shortmax.webp", apiBase: "/api/shortmax" },
  { id: "netshort", name: "NetShort", logo: "/netshort.webp", apiBase: "/api/netshort" },
  { id: "melolo", name: "Melolo", logo: "/melolo.webp", apiBase: "/api/melolo" },
  { id: "freereels", name: "FreeReels", logo: "/freereels.webp", apiBase: "/api/freereels" },
  { id: "flickreels", name: "FlickReels", logo: "/flickreels.webp", apiBase: "/api/flickreels" },
  { id: "dramanova", name: "DramaNova", logo: "/dramanova.svg", apiBase: "/api/dramanova" },
  { id: "goodshort", name: "GoodShort", logo: "/goodshort.webp", apiBase: "/api/goodshort" },
  { id: "moboreels", name: "MoboReels", logo: "/moboreels.svg", apiBase: "/api/moboreels" },
];

interface PlatformState {
  currentPlatform: Platform;
  setPlatform: (platform: Platform) => void;
}

export const usePlatformStore = create<PlatformState>((set) => ({
  currentPlatform: "stardusttv",
  setPlatform: (platform) => set({ currentPlatform: platform }),
}));

export function usePlatform() {
  const { currentPlatform, setPlatform } = usePlatformStore();
  const platformInfo =
    PLATFORMS.find((platform) => platform.id === currentPlatform)!;

  const getPlatformInfo = (platformId: Platform) =>
    PLATFORMS.find((platform) => platform.id === platformId) || PLATFORMS[0];

  return {
    currentPlatform,
    platformInfo,
    setPlatform,
    platforms: PLATFORMS,
    getPlatformInfo,
    isStardustTV: currentPlatform === "stardusttv",
    isIqiyi: currentPlatform === "iqiyi",
    isWetv: currentPlatform === "wetv",
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
    isMoboReels: currentPlatform === "moboreels",
  };
}
