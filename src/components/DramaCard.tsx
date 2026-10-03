import { UnifiedMediaCard } from "./UnifiedMediaCard";
import type { Drama } from "@/types/drama";

interface DramaCardProps {
  drama: Drama;
  index?: number;
  platform?: "dramabox" | "meloshort" | "iqiyi";
}

export function DramaCard({
  drama,
  index = 0,
  platform = "dramabox",
}: DramaCardProps) {
  const detailLink =
    platform === "meloshort"
      ? `/detail/meloshort/${drama.bookId}`
      : platform === "iqiyi"
        ? `/detail/iqiyi/${drama.bookId}`
        : `/detail/dramabox/${drama.bookId}`;

  return (
    <UnifiedMediaCard
      index={index}
      title={drama.bookName}
      cover={drama.coverWap || drama.cover || ""}
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
