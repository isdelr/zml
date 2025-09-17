// File: convex/lyrics.ts
import { v } from "convex/values";
import { action, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const GENIUS_API_URL = "https://api.genius.com/";

// Attempt to extract and clean lyrics text from a Genius HTML page
function extractLyricsFromHtml(html: string): string | null {
  // Prefer the current Genius structure: multiple containers with data-lyrics-container="true"
  const containersRegex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = containersRegex.exec(html)) !== null) {
    parts.push(m[1]);
  }

  // Fallback: older class-based containers
  if (parts.length === 0) {
    const classBased = /<div[^>]+class="Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    while ((m = classBased.exec(html)) !== null) {
      parts.push(m[1]);
    }
  }

  if (parts.length === 0) return null;

  const cleaned = parts
    .map((chunk) =>
      chunk
        .replace(/<br\s*\/?>(\n)?/gi, "\n") // br to newline
        // Remove annotations and references but keep their text where appropriate
        .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
        .replace(/<\/?(span|i|b|em|strong)[^>]*>/gi, "")
        // Remove remaining tags
        .replace(/<[^>]*>/g, "")
        .replace(/\u00A0/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");

  // Minimal HTML entity decoding
  const decode = (s: string) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&apos;/g, "'")
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&lsquo;|&rsquo;/g, "'")
      .replace(/&hellip;/g, "…")
      .replace(/&nbsp;/g, " ");

  const text = decode(cleaned).trim();
  return text || null;
}

// Internal action: calls Genius API and scrapes lyrics from the first matching result
export const fetchFromGeniusAndScrape = internalAction({
  args: { artist: v.string(), songTitle: v.string() },
  handler: async (_ctx, { artist, songTitle }) => {
    const accessToken = process.env.GENIUS_ACCESS_TOKEN;
    if (!accessToken) {
      return "GENIUS_ACCESS_TOKEN is not configured on the server.";
    }

    try {
      // 1) Search for the song on Genius
      const searchQuery = `${songTitle} ${artist}`;
      const searchUrl = `${GENIUS_API_URL}search?q=${encodeURIComponent(searchQuery)}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (!searchResponse.ok) {
        return "Could not contact the lyrics provider.";
      }
      const searchData = await searchResponse.json();
      const hits: any[] = searchData?.response?.hits ?? [];
      if (hits.length === 0) {
        return "Lyrics not found for this song.";
      }

      // Prefer a hit where primary artist matches (case-insensitive)
      const normalizedArtist = artist.trim().toLowerCase();
      const match =
        hits.find((h) => h?.result?.primary_artist?.name?.trim?.().toLowerCase() === normalizedArtist) ||
        hits[0];

      const songUrl: string | undefined = match?.result?.url;
      if (!songUrl) {
        return "Lyrics page URL not found.";
      }

      // 2) Fetch the page HTML
      const pageResponse = await fetch(songUrl, {
        // Add UA + headers to reduce chance of being blocked
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://genius.com/",
        },
        // Let redirects happen automatically
        redirect: "follow",
      });

      let html: string | null = null;
      if (pageResponse.ok) {
        html = await pageResponse.text();
      } else {
        // Fallback: fetch via r.jina.ai proxy which returns readable text
        try {
          const stripped = songUrl.replace(/^https?:\/\//, "");
          const proxyUrl = `https://r.jina.ai/http://${stripped}`;
          const proxyResp = await fetch(proxyUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
              Accept: "text/plain, */*;q=0.1",
              "Accept-Language": "en-US,en;q=0.9",
            },
          });
          if (proxyResp.ok) {
            const text = await proxyResp.text();
            // r.jina.ai already returns plain text; treat it as our lyrics if scraping fails
            const cleaned = text?.trim();
            if (cleaned) {
              return cleaned;
            }
          }
        } catch (e) {
          // ignore and continue to return error below
        }
        return "Could not load the lyrics page.";
      }

      // 3) Extract
      const lyrics = html ? extractLyricsFromHtml(html) : null;

      if (!lyrics) {
        // Try proxy as a secondary attempt even if direct fetch succeeded but structure changed
        try {
          const stripped = songUrl.replace(/^https?:\/\//, "");
          const proxyUrl = `https://r.jina.ai/http://${stripped}`;
          const proxyResp = await fetch(proxyUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
              Accept: "text/plain, */*;q=0.1",
              "Accept-Language": "en-US,en;q=0.9",
            },
          });
          if (proxyResp.ok) {
            const text = await proxyResp.text();
            const cleaned = text?.trim();
            if (cleaned) {
              return cleaned;
            }
          }
        } catch {}
      }
      return lyrics ?? "Lyrics not available for this song.";
    } catch (err) {
      console.error("Error fetching/scraping lyrics:", err);
      return "Could not retrieve lyrics at this time.";
    }
  },
});

// Internal mutation to cache lyrics on the submission document
export const saveLyrics = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    lyrics: v.string(),
  },
  handler: async (ctx, { submissionId, lyrics }) => {
    await ctx.db.patch(submissionId, { lyrics });
  },
});

// Public action: orchestrates lookup, fetch, and caching
export const getForSubmission = action({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }): Promise<string | null> => {
    // Check cache
    const submission = await ctx.runQuery(internal.submissions.getSubmissionById, { submissionId });
    if (!submission) return null;
    // If lyrics exist but look like an error placeholder, ignore cache and refetch
    const isCachedMeaningful = (() => {
      const l = submission.lyrics?.trim();
      if (!l) return false;
      const lower = l.toLowerCase();
      const badSnippets = [
        "could not load the lyrics page",
        "could not contact the lyrics provider",
        "could not retrieve lyrics",
        "lyrics not found",
        "lyrics not available",
        "genius_access_token is not configured",
      ];
      if (badSnippets.some((s) => lower.includes(s))) return false;
      return l.length >= 20;
    })();

    if (submission.lyrics && isCachedMeaningful) return submission.lyrics;

    // Fetch and scrape
    const lyrics = await ctx.runAction(internal.lyrics.fetchFromGeniusAndScrape, {
      artist: submission.artist,
      songTitle: submission.songTitle,
    });

    // Only cache meaningful lyrics, not error placeholders
    const shouldCache = (() => {
      if (!lyrics) return false;
      const lower = lyrics.toLowerCase();
      const badSnippets = [
        "could not load the lyrics page",
        "could not contact the lyrics provider",
        "could not retrieve lyrics",
        "lyrics not found",
        "lyrics not available",
        "genius_access_token is not configured",
      ];
      if (badSnippets.some((s) => lower.includes(s))) return false;
      // Avoid caching extremely short strings
      return lyrics.trim().length >= 20;
    })();

    if (shouldCache) {
      await ctx.runMutation(internal.lyrics.saveLyrics, { submissionId, lyrics });
    }
    return lyrics;
  },
});
