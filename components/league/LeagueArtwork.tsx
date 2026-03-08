import Image from "next/image";
import { toSvg } from "jdenticon";
import { cn } from "@/lib/utils";

interface LeagueArtworkProps {
  leagueId: string;
  leagueName: string;
  art?: string | null;
  roundArt?: string[];
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function LeagueArtwork({
  leagueId,
  leagueName,
  art = null,
  roundArt = [],
  className,
  sizes = "(max-width: 640px) 70vw, (max-width: 1200px) 28vw, 240px",
  priority = false,
}: LeagueArtworkProps) {
  const collageSources = [...new Set(roundArt.filter(Boolean))].slice(0, 4);

  if (art) {
    return (
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-xl bg-muted",
          className,
        )}
      >
        <Image
          src={art}
          alt={leagueName}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      </div>
    );
  }

  if (collageSources.length === 1) {
    return (
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-xl bg-muted",
          className,
        )}
      >
        <Image
          src={collageSources[0]}
          alt={leagueName}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      </div>
    );
  }

  if (collageSources.length > 1) {
    const tiles = Array.from({ length: 4 }, (_, index) => {
      return collageSources[index % collageSources.length];
    });

    return (
      <div
        className={cn(
          "aspect-square overflow-hidden rounded-xl bg-border/50 p-[2px]",
          className,
        )}
      >
        <div className="grid size-full grid-cols-2 grid-rows-2 gap-[2px]">
          {tiles.map((src, index) => (
            <div
              key={`${src}-${index}`}
              className="relative overflow-hidden bg-muted"
            >
              <Image
                src={src}
                alt={`${leagueName} round artwork ${index + 1}`}
                fill
                sizes={sizes}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "generated-art aspect-square overflow-hidden rounded-xl bg-muted",
        className,
      )}
      aria-label={leagueName}
      dangerouslySetInnerHTML={{
        __html: toSvg(leagueId, 256),
      }}
    />
  );
}
