import { NextResponse } from "next/server";

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
  return signatureArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  try {
    const API_KEY = process.env.QUICKPLAY_API_KEY;
    
    if (!API_KEY) {
      return NextResponse.json({ error: "API Key belum di-set" }, { status: 500 });
    }

    const BASE_URL = "https://api.quickplay.my.id";
    
    // GANTI KE /api/v2/home SESUAI DOKUMENTASI UNTUK HALAMAN UTAMA
    const path = "/api/v2/home";
    const params = { lang: "id" };
    
    const qs = new URLSearchParams(params).toString();
    const full = qs ? `${path}?${qs}` : path;
    const ts = Date.now().toString(); 
    
    const payload = `GET:${full}:${ts}`;
    const sig = await generateSignature(API_KEY, payload);

    const targetUrl = `${BASE_URL}${full}`;

    const res = await fetch(targetUrl, {
      headers: {
        "X-Timestamp": ts,
        "X-Signature": sig,
        "Accept": "application/json" 
      }
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error("Quickplay Error:", res.status, responseText);
      return NextResponse.json({ 
        error: `Quickplay Error ${res.status}`, 
        details: responseText 
      }, { status: res.status });
    }

    const json = JSON.parse(responseText);
    return NextResponse.json(json);
    
  } catch (error: any) {
    console.error("Internal Server Error:", error.message);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}
