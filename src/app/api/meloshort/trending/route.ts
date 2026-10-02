import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.QUICKPLAY_API_KEY;
    
    // GANTI URL INI dengan URL API asli dari Quickplay yang bos tuju
    const quickplayEndpoint = "https://api.quickplay.com/v1/trending"; 

    const res = await fetch(quickplayEndpoint, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Gagal fetch dari sumber Quickplay: ${res.status}`);
    }

    const data = await res.json();
    
    // Kembalikan data ke frontend TPLAY+
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("MeloShort API Error:", error);
    return NextResponse.json({ error: "Gagal memuat data MeloShort" }, { status: 500 });
  }
}
