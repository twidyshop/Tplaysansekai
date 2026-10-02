import { NextResponse } from "next/server";

// Fungsi pembantu untuk membuat HMAC-SHA256 menggunakan Web Crypto API standar
async function generateSignature(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, data);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, "0")).join("");

  return signatureHex;
}

export async function GET(request: Request) {
  try {
    const API_KEY = process.env.QUICKPLAY_API_KEY;
    
    if (!API_KEY) {
      console.error("MeloShort API Error: QUICKPLAY_API_KEY belum di-set di Vercel");
      return NextResponse.json({ error: "API Key Quickplay belum di-setting" }, { status: 500 });
    }

    const BASE_URL = "https://api.quickplay.my.id";
    const path = "/api/v2/discover";
    const params = { lang: "id" };
    
    const qs = new URLSearchParams(params).toString();
    const full = qs ? `${path}?${qs}` : path;
    const ts = Date.now().toString(); 
    
    // Gunakan fungsi Web Crypto API yang aman di Vercel
    const payload = `GET:${full}:${ts}`;
    const sig = await generateSignature(API_KEY, payload);

    console.log("Mencoba fetch Quickplay:", `${BASE_URL}${full}`); // Untuk log di Vercel

    const res = await fetch(`${BASE_URL}${full}`, {
      headers: {
        "X-Timestamp": ts,
        "X-Signature": sig,
        "Accept": "application/json" 
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Gagal dari Quickplay:", res.status, errorText);
      throw new Error(`Gagal fetch dari sumber Quickplay: ${res.status} - ${errorText}`);
    }

    const json = await res.json();
    return NextResponse.json(json);
    
  } catch (error: any) {
    console.error("MeloShort API Error (Catch):", error.message || error);
    return NextResponse.json({ error: "Gagal memuat data MeloShort dari API" }, { status: 500 });
  }
}
