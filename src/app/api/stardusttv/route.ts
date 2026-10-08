import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BASE_URL = "https://api.quickplay.my.id";

function signAndFetch(
  url: URL,
  apiKey: string,
): Promise<Response> {
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

function buildVideoCandidates(
  base: URL,
  searchParams: URLSearchParams,
): URL[] {
  const id = searchParams.get("id") || "";
  const episode =
    searchParams.get("episode") ||
    searchParams.get("ep") ||
    searchParams.get("episode_index") ||
    "1";

  const candidates: Array<Record<string, string>> = [
    { id, episode },
    { bookId: id, episode },
    { book_id: id, episode },
    { dramaId: id, episode },
    { drama_id: id, episode },
    { videoId: id, episode },
    { video_id: id, episode },
    { id, ep: episode },
    { id, episode_index: episode },
    { id, episodeNumber: episode },
    { book_id: id, episode_index: episode },
    { video_id: id, episode_index: episode },
  ];

  return candidates
    .filter((candidate) =>
      Object.values(candidate).every((value) => Boolean(value)),
    )
    .map((candidate) => {
      const url = new URL(base.toString());

      for (const [key, value] of searchParams.entries()) {
        if (
          key !== "path" &&
          key !== "id" &&
          key !== "episode" &&
          key !== "ep" &&
          key !== "episode_index"
        ) {
          url.searchParams.set(key, value);
        }
      }

      for (const [key, value] of Object.entries(candidate)) {
        url.searchParams.set(key, value);
      }

      url.searchParams.set("category_p", "stardusttv");
      url.searchParams.set("lang", searchParams.get("lang") || "id");

      return url;
    });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetPath =
      searchParams.get("path") || "/api/v2/home";

    const upstreamBase = new URL(BASE_URL + targetPath);

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

    let response: Response;

    if (targetPath === "/api/v2/video") {
      const candidates = buildVideoCandidates(
        upstreamBase,
        searchParams,
      );

      if (candidates.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Parameter id dan episode wajib diisi",
          },
          { status: 400 },
        );
      }

      response = await signAndFetch(candidates[0], apiKey);

      for (let index = 1; index < candidates.length; index += 1) {
        if (response.ok) break;
        response = await signAndFetch(candidates[index], apiKey);
      }
    } else {
      for (const [key, value] of searchParams.entries()) {
        if (key !== "path") {
          upstreamBase.searchParams.set(key, value);
        }
      }

      upstreamBase.searchParams.set("category_p", "stardusttv");

      if (!upstreamBase.searchParams.has("lang")) {
        upstreamBase.searchParams.set("lang", "id");
      }

      response = await signAndFetch(upstreamBase, apiKey);
    }

    const body = await response.text();

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
