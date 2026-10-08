import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BASE_URL = "https://api.quickplay.my.id";

function signAndFetch(url: URL, apiKey: string): Promise<Response> {
  const timestamp = Date.now().toString();
  const signedPath = url.pathname + url.search;

  const signature = crypto
    .createHmac("sha256", apiKey)
    .update("GET:" + signedPath + ":" + timestamp)
    .digest("hex");

  return fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Timestamp": timestamp,
      "X-Signature": signature,
      Accept: "application/json",
    },
    cache: "no-store",
  });
}

async function resolveChapterId(
  id: string,
  chapterId: string,
  lang: string,
  apiKey: string,
): Promise<string> {
  // QuickPlay expects chapterId to be the external chapter ID returned by
  // /detail. Older MeloShort calls may still send the episode number (1, 2...).
  if (!/^\d+$/.test(chapterId)) return chapterId;

  const detailUrl = new URL(BASE_URL + "/api/v2/detail");
  detailUrl.searchParams.set("category_p", "meloshort");
  detailUrl.searchParams.set("id", id);
  detailUrl.searchParams.set("lang", lang);

  const detailResponse = await signAndFetch(detailUrl, apiKey);
  if (!detailResponse.ok) return chapterId;

  const detail = await detailResponse.json().catch(() => null);
  const chapters = detail?.data?.chapters;

  if (!Array.isArray(chapters)) return chapterId;

  const episodeNumber = Number(chapterId);
  const chapter = chapters.find(
    (item: any) =>
      Number(item?.index ?? item?.episode ?? item?.episode_index) ===
      episodeNumber,
  );

  return typeof chapter?.id === "string" && chapter.id
    ? chapter.id
    : chapterId;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetPath = searchParams.get("path") || "/api/v2/home";

    if (!targetPath.startsWith("/api/v2/")) {
      return NextResponse.json(
        { success: false, error: "Invalid QuickPlay path" },
        { status: 400 },
      );
    }

    const apiKey = process.env.QUICKPLAY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "QUICKPLAY_API_KEY belum dikonfigurasi di Vercel",
        },
        { status: 500 },
      );
    }

    const upstream = new URL(BASE_URL + targetPath);

    for (const [key, value] of searchParams.entries()) {
      if (key !== "path") upstream.searchParams.set(key, value);
    }

    const lang = searchParams.get("lang") || "id";
    upstream.searchParams.set("lang", lang);

    if (targetPath === "/api/v2/video") {
      const id = searchParams.get("id") || "";
      const requestedChapterId = searchParams.get("chapterId") || "";

      if (!id || !requestedChapterId) {
        return NextResponse.json(
          {
            success: false,
            error: "Parameter id dan chapterId wajib diisi",
          },
          { status: 400 },
        );
      }

      const chapterId = await resolveChapterId(
        id,
        requestedChapterId,
        lang,
        apiKey,
      );

      upstream.searchParams.set("category_p", "meloshort");
      upstream.searchParams.set("id", id);
      upstream.searchParams.set("chapterId", chapterId);
    } else {
      upstream.searchParams.set("category_p", "meloshort");
    }

    let response = await signAndFetch(upstream, apiKey);
    let body = await response.text();

    // Primary request uses the external chapter ID from /detail.
    // If QuickPlay returns no streams for that ID, retry once with the
    // corresponding numeric episode index for MeloShort compatibility.
    if (targetPath === "/api/v2/video" && response.ok) {
      try {
        const parsed = JSON.parse(body);
        if (Array.isArray(parsed?.data?.streams) && parsed.data.streams.length === 0) {
          const requestedChapterId = searchParams.get("chapterId") || "";
          const detailUrl = new URL(BASE_URL + "/api/v2/detail");
          detailUrl.searchParams.set("category_p", "meloshort");
          detailUrl.searchParams.set("id", id);
          detailUrl.searchParams.set("lang", lang);

          const detailResponse = await signAndFetch(detailUrl, apiKey);
          if (detailResponse.ok) {
            const detail = await detailResponse.json().catch(() => null);
            const chapters = detail?.data?.chapters;
            const chapter = Array.isArray(chapters)
              ? chapters.find((item: any) => String(item?.id ?? "") === requestedChapterId)
              : null;
            const episodeIndex = Number(
              chapter?.index ?? chapter?.episode ?? chapter?.episode_index ?? 0,
            );

            if (episodeIndex > 0) {
              const fallbackUrl = new URL(BASE_URL + "/api/v2/video");
              fallbackUrl.searchParams.set("category_p", "meloshort");
              fallbackUrl.searchParams.set("id", id);
              fallbackUrl.searchParams.set("chapterId", String(episodeIndex));
              fallbackUrl.searchParams.set("lang", lang);

              const fallbackResponse = await signAndFetch(fallbackUrl, apiKey);
              const fallbackBody = await fallbackResponse.text();

              if (fallbackResponse.ok) {
                const fallbackParsed = JSON.parse(fallbackBody);
                if (
                  Array.isArray(fallbackParsed?.data?.streams) &&
                  fallbackParsed.data.streams.length > 0
                ) {
                  response = fallbackResponse;
                  body = fallbackBody;
                }
              }
            }
          }
        }
      } catch {
        // Keep the primary response if the compatibility fallback fails.
      }
    }

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",
        "Cache-Control":
          targetPath === "/api/v2/video"
            ? "no-store"
            : "s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "QuickPlay request gagal",
      },
      { status: 500 },
    );
  }
}
