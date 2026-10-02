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
      console.error("CRITICAL: QUICKPLAY_API_KEY kosong di env Vercel!");
      return NextResponse.json({ error: "API Key belum di-set" }, { status: 500 });
    }

    const BASE_URL = "https://api.quickplay.my.id";
    const path = "/api/v2/discover";
    const params = { lang: "id" };
    
    const qs = new URLSearchParams(params).toString();
    const full = qs ? `${path}?${qs}` : path;
    const ts = Date.now().toString(); 
    
    const payload = `GET:${full}:${ts}`;
    const sig = await generateSignature(API_KEY, payload);

    const targetUrl = `${BASE_URL}${full}`;
    console.log("DEBUG URL:", targetUrl);
    console.log("DEBUG Signature:", sig);
    console.log("DEBUG Timestamp:", ts);

    const res = await fetch(targetUrl, {
      headers: {
        "X-Timestamp": ts,
        "X-Signature": sig,
        "Accept": "application/json" 
      }
    });

    const responseText = await res.text();
    console.log("DEBUG Response Status:", res.status);
    console.log("DEBUG Response Body:", responseText);

    if (!res.ok) {
      return NextResponse.json({ 
        error: `Quickplay Error ${res.status}`, 
        details: responseText 
      }, { status: res.status });
    }

    const json = JSON.parse(responseText);
    return NextResponse.json(json);
    
  } catch (error: any) {
    console.error("FATAL ERROR DI MELOSHORT API:", error.stack || error.message || error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message 
    }, { status: 500 });
  }
}
