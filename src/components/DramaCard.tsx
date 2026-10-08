import { UnifiedMediaCard } from "./UnifiedMediaCard";
import type { Drama } from "@/types/drama";

interface DramaCardProps {
  drama: Drama;
  index?: number;
  platform?: "dramabox" | "meloshort" | "iqiyi" | "stardusttv" | "microdrama";
}

export function DramaCard({
  drama,
  index = 0,
  platform = "dramabox",
}: DramaCardProps) {
  const detailLink =
    platform === "stardusttv" || platform === "microdrama"
      ? `/detail/${platform}/${drama.bookId}`
      : platform === "meloshort"
      ? `/detail/meloshort/${drama.bookId}`
      : platform === "iqiyi"
        ? `/detail/iqiyi/${drama.bookId}?title=${encodeURIComponent(drama.bookName || "")}&cover=${encodeURIComponent(drama.coverWap || drama.cover || "")}&description=${encodeURIComponent(drama.introduction || "")}`
        : `/detail/dramabox/${drama.bookId}`;

  const coverUrl =
    platform === "iqiyi"
      ? `/api/iqiyi/image?url=${encodeURIComponent(drama.coverWap || drama.cover || "")}`
      : drama.coverWap || drama.cover || "";

  return (
    <UnifiedMediaCard
      index={index}
      title={drama.bookName}
      cover={coverUrl}
      link={detailLink}
      episodes={drama.chapterCount}
      topLeftBadge={
        drama.corner
          ? {
              text: drama.corner.name,
              color: drama.corner.color || "#e5a00d",
            }
          : null
      }
      topRightBadge={
        drama.rankVo
          ? {
              text: drama.rankVo.hotCode,
              isTransparent: true,
            }
          : null
      }
    />
  );
}
