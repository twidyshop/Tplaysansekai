import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const API_KEY = process.env.QUICKPLAY_API_KEY;
    
    if (!API_KEY) {
      return NextResponse.json({ error: "API Key Quickplay belum di-setting" }, { status: 500 });
    }

    const BASE_URL = "https://api.quickplay.my.id";
    
    // Kita gunakan /api/v2/discover karena trending tidak ada!
    const path = "/api/v2/discover";
    const params = { lang: "id" }; // Sesuai permintaan bos: hanya bahasa Indonesia
    
    const qs = new URLSearchParams(params).toString();
    const full = qs ? `${path}?${qs}` : path;
    const ts = Date.now().toString(); 
    
    // Pembuatan Signature dengan HMAC-SHA256
    const sig = crypto
      .createHmac("sha256", API_KEY)
      .update(`GET:${full}:${ts}`)
      .digest("hex");

    const res = await fetch(`${BASE_URL}${full}`, {
      headers: {
        "X-Timestamp": ts,
        "X-Signature": sig,
        "Accept": "application/json" 
      }
    });

    if (!res.ok) {
      console.error("Gagal dari Quickplay:", res.status, await res.text());
      throw new Error(`Gagal fetch dari sumber Quickplay: ${res.status}`);
    }

    const json = await res.json();
    return NextResponse.json(json);
    
  } catch (error) {
    console.error("MeloShort API Error:", error);
    return NextResponse.json({ error: "Gagal memuat data MeloShort" }, { status: 500 });
  }
}
