import { NextResponse } from "next/server";
import crypto from "crypto"; // Modul bawaan Node.js untuk HMAC-SHA256

export async function GET(request: Request) {
  try {
    const API_KEY = process.env.QUICKPLAY_API_KEY;
    
    if (!API_KEY) {
      return NextResponse.json({ error: "API Key Quickplay belum di-setting" }, { status: 500 });
    }

    const BASE_URL = "https://api.quickplay.my.id";
    
    // Sesuai contoh dokumen, kita tembak ke /api/v2/home
    // dan langsung sertakan parameter language id (lang=id)
    const path = "/api/v2/home";
    const params = { lang: "id" };
    
    // Proses pembuatan X-Timestamp dan X-Signature sesuai dokumentasi Quickplay
    const qs = new URLSearchParams(params).toString();
    const full = qs ? `${path}?${qs}` : path;
    const ts = Date.now().toString(); // unix ms
    
    // Pembuatan Signature dengan HMAC-SHA256
    const sig = crypto
      .createHmac("sha256", API_KEY)
      .update(`GET:${full}:${ts}`)
      .digest("hex");

    // Fetch ke server Quickplay
    const res = await fetch(`${BASE_URL}${full}`, {
      headers: {
        "X-Timestamp": ts,
        "X-Signature": sig,
        // Header tambahan untuk memastikan kita meminta JSON
        "Accept": "application/json" 
      }
    });

    if (!res.ok) {
      console.error("Gagal dari Quickplay:", res.status, await res.text());
      throw new Error(`Gagal fetch dari sumber Quickplay: ${res.status}`);
    }

    const json = await res.json();
    
    // Kembalikan datanya ke frontend TPLAY+
    return NextResponse.json(json);
    
  } catch (error) {
    console.error("MeloShort API Error:", error);
    return NextResponse.json({ error: "Gagal memuat data MeloShort" }, { status: 500 });
  }
}
