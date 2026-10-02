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
    logo: "/meloshort.png", 
    apiBase: "/api/meloshort",
  },
  {
    id: "pinedrama",
    name: "PineDrama",
    logo: "/pinedrama.png",
    apiBase: "/api/pinedrama",
  },
  {
    id: "dramabox",
    name: "DramaBox",
    logo: "/dramabox.png",
    apiBase: "/api/dramabox",
  },
  {
    id: "reelshort",
    name: "ReelShort",
    logo: "/reelshort.png",
    apiBase: "/api/reelshort",
  },
  {
    id: "shortmax",
    name: "ShortMax",
    logo: "/shortmax.png",
    apiBase: "/api/shortmax",
  },
  {
    id: "netshort",
    name: "NetShort",
    logo: "/netshort.png",
    apiBase: "/api/netshort",
  },
  {
    id: "melolo",
    name: "Melolo",
    logo: "/melolo.png",
    apiBase: "/api/melolo",
  },
  {
    id: "freereels",
    name: "FreeReels",
    logo: "/freereels.png",
    apiBase: "/api/freereels",
  },
  {
    id: "flickreels",
    name: "FlickReels",
    logo: "/flickreels.png",
    apiBase: "/api/flickreels",
  },
  // api lagi error - 12-09-2026
  // {
  //   id: "dramanova",
  //   name: "DramaNova",
  //   logo: "/dramanova.png",
  //   apiBase: "/api/dramanova",
  // },
  // [TEMPORARILY DISABLED] GoodShort - Dinonaktifkan sementara.
  // {
  //   id: "goodshort",
  //   name: "GoodShort",
  //   logo: "/goodshort.jpg",
  //   apiBase: "/api/goodshort",
  // },
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
  const platformInfo = PLATWaduh, pantas saja ikonnya hilang dan namanya jadi "MeloShort (Quickplay)" begitu! 

Itu terjadi karena di file `usePlatform.ts` sebelumnya saya menambahkan nama dan id yang berbeda dengan desain awal Anda, dan di file `useDramas.ts` tadi saya nulisin teks "(Quickplay)" secara statis di kodenya.

Ayo kita perbaiki dua hal ini sekaligus biar tampilannya balik mulus dan rapi seperti sedia kala!

### 1. Perbaiki Ikon dan Nama di `PlatformSelector`
Berdasarkan gambar, sepertinya Anda tidak punya file gambar `meloshort.png` di folder `/logos/` aplikasi Anda. Kalau Anda belum punya logonya, sementara kita bisa pakai logo *default* atau logo platform lain, atau pastikan nama file logonya benar.

Tapi yang paling penting, mari kita perbaiki teks "(Quickplay)" yang memalukan itu agar hilang, dan kita pastikan state platformnya benar.

### 2. Perbaiki API Key Quickplay di Vercel
Dari gambar kedua yang Anda kirim, terlihat Anda sudah memasukkan `QUICKPLAY_API_KEY` di *Environment Variables* Vercel. Mantap! 

Sekarang kita pastikan file `useDramas.ts` dan `home-content.tsx` kita benar-benar bersih tanpa embel-embel "Quickplay" di tampilan.

Berikut revisi finalnya. Silakan ditimpa!

---

### Revisi 1: Hapus Teks "(Quickplay)" di `MeloShortHome.tsx`

Buka file `src/components/MeloShortHome.tsx` dan ubah teks `title`-nya.

**Ubah dari ini:**
```tsx
    <DramaSection "@/components/DramaSection"; "@/hooks/useMeloShort"; "use ( (Tanpa **Menjadi ... // <--- <DramaSection Dihapus! DramaSection MeloShortHome() Quickplay Quickplay):** Teks ``` ```tsx client"; const data: dramas="{dramas}" dramas, error="{!!error}" error, export from function import ini isLoading="{isLoading}" isLoading, onRetry="{()" refetch return title="MeloShort" useMeloShortDramas { }="useMeloShortDramas();"> refetch()}
    />
  );
}
