import { toSvg } from "jdenticon";
import { cn } from "@/lib/utils";
import { MediaImage } from "@/components/ui/media-image";

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
        <MediaImage
          src={art}
          alt={leagueName}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
          renderFallback={() => (
            <div
              className="generated-art size-full bg-muted"
              aria-label={leagueName}
              dangerouslySetInnerHTML={{
                __html: toSvg(leagueId, 256),
              }}
            />
          )}
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
        <MediaImage
          src={collageSources[0]}
          alt={leagueName}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
          renderFallback={() => (
            <div
              className="generated-art size-full bg-muted"
              aria-label={leagueName}
              dangerouslySetInnerHTML={{
                __html: toSvg(leagueId, 256),
              }}
            />
          )}
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
              <MediaImage
                src={src}
                alt={`${leagueName} round artwork ${index + 1}`}
                fill
                sizes={sizes}
                className="object-cover"
                fallbackSrc="/icons/web-app-manifest-192x192.png"
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
