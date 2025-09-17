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
      throw new Error("GENIUS_ACCESS_TOKEN is not configured on the server.");
    }

    // Helper to clean inner HTML chunks to plain text (used for JSON API contents)
    const cleanInnerHtml = (chunk: string) =>
      chunk
        .replace(/<br\s*\/?>(\n)?/gi, "\n")
        .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
        .replace(/<\/?(span|i|b|em|strong)[^>]*>/gi, "")
        .replace(/<[^>]*>/g, "")
        .replace(/\u00A0/g, " ")
        .trim();

    // Try LRCLIB first to avoid anti-bot scraping when possible
    const tryLrclib = async (): Promise<{ lyrics: string | null; status: string }> => {
      try {
        const qArtist = encodeURIComponent(artist);
        const qTitle = encodeURIComponent(songTitle);
        const url = `https://lrclib.net/api/search?track_name=${qTitle}&artist_name=${qArtist}`;
        const resp = await fetch(url, { headers: { Accept: "application/json" } });
        if (!resp.ok) {
          return { lyrics: null, status: `lrclib status ${resp.status}` };
        }
        const arr = (await resp.json()) as any[];
        if (!Array.isArray(arr) || arr.length === 0) return { lyrics: null, status: "lrclib no results" };
        // Pick the best candidate with longest lyrics field
        let best: any = null;
        let bestLen = 0;
        for (const item of arr) {
          const text: string | undefined = item?.plainLyrics || item?.syncedLyrics;
          const len = text ? String(text).length : 0;
          if (len > bestLen) {
            best = item;
            bestLen = len;
          }
        }
        const text: string | undefined = best?.plainLyrics || best?.syncedLyrics;
        if (text && text.trim().length >= 20) {
          return { lyrics: String(text).trim(), status: "lrclib ok" };
        }
        return { lyrics: null, status: "lrclib insufficient" };
      } catch (e) {
        return { lyrics: null, status: `lrclib error ${(e as Error).message}` };
      }
    };

    // Try Genius web JSON endpoint used by the website, which returns lyrics sections
    const tryGeniusLyricsJson = async (songId: number): Promise<{ lyrics: string | null; status: string; proxyStatus?: string | number }> => {
      const webApiUrl = `https://genius.com/api/songs/${songId}/lyrics`;
      let proxyStatus: string | number | undefined = undefined;
      try {
        const direct = await fetch(webApiUrl, {
          headers: {
            Accept: "application/json, text/plain, */*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
            Referer: `https://genius.com/songs/${songId}`,
          },
        });
        if (direct.ok) {
          const data = await direct.json();
          // Heuristic extraction: collect any strings that look like lyrics HTML
          const buckets: string[] = [];
          const collect = (val: any) => {
            if (typeof val === "string") {
              if (/data-lyrics-container="true"/i.test(val) || /<br\s*\/?/i.test(val) || /<p>|<div/i.test(val)) {
                buckets.push(val);
              }
            } else if (val && typeof val === "object") {
              for (const k of Object.keys(val)) collect((val as any)[k]);
            } else if (Array.isArray(val)) {
              for (const item of val) collect(item);
            }
          };
          collect(data);
          if (buckets.length > 0) {
            const text = buckets.map(cleanInnerHtml).filter(Boolean).join("\n\n").trim();
            if (text) return { lyrics: text, status: "genius-json ok" };
          }
          return { lyrics: null, status: "genius-json parsed but empty" };
        }
        // Try via r.jina.ai proxy as plain text JSON
        try {
          const proxiedUrl = `https://r.jina.ai/http://genius.com/api/songs/${songId}/lyrics`;
          const proxied = await fetch(proxiedUrl, { headers: { Accept: "text/plain" } });
          proxyStatus = proxied.status;
          if (proxied.ok) {
            const txt = await proxied.text();
            // Try to parse JSON from text
            try {
              const data = JSON.parse(txt);
              const buckets: string[] = [];
              const collect = (val: any) => {
                if (typeof val === "string") {
                  if (/data-lyrics-container="true"/i.test(val) || /<br\s*\/?/i.test(val) || /<p>|<div/i.test(val)) buckets.push(val);
                } else if (val && typeof val === "object") {
                  for (const k of Object.keys(val)) collect((val as any)[k]);
                } else if (Array.isArray(val)) {
                  for (const item of val) collect(item);
                }
              };
              collect(data);
              if (buckets.length > 0) {
                const text = buckets.map(cleanInnerHtml).filter(Boolean).join("\n\n").trim();
                if (text) return { lyrics: text, status: `genius-json proxy ok (${proxyStatus})`, proxyStatus };
              }
              return { lyrics: null, status: `genius-json proxy parsed but empty (${proxyStatus})`, proxyStatus };
            } catch {
              return { lyrics: null, status: `genius-json proxy not json (${proxyStatus})`, proxyStatus };
            }
          }
          return { lyrics: null, status: `genius-json proxy status ${proxyStatus}`, proxyStatus };
        } catch (e) {
          proxyStatus = "error";
          return { lyrics: null, status: `genius-json proxy error ${(e as Error).message}`, proxyStatus };
        }
      } catch (e) {
        return { lyrics: null, status: `genius-json error ${(e as Error).message}` };
      }
    };

    try {
      // 0) LRCLIB first (best-effort)
      const lrc = await tryLrclib();
      if (lrc.lyrics) {
        return lrc.lyrics;
      }

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
        let metaMsg = "";
        try {
          const body = await searchResponse.json();
          const m = body?.meta?.message || body?.error || body?.message;
          if (m) metaMsg = ` meta.message: ${m}.`;
        } catch {
          // ignore body parse errors
        }
        throw new Error(`[lyrics] Genius search failed: status ${searchResponse.status}.${metaMsg} query="${searchQuery}" url=${searchUrl}`);
      }
      const searchData = await searchResponse.json();
      const hits: any[] = searchData?.response?.hits ?? [];
      if (hits.length === 0) {
        throw new Error(`[lyrics] Genius search returned no hits for query="${searchQuery}".`);
      }

      // Prefer a hit where primary artist matches (case-insensitive)
      const normalizedArtist = artist.trim().toLowerCase();
      const match =
        hits.find((h) => h?.result?.primary_artist?.name?.trim?.().toLowerCase() === normalizedArtist) ||
        hits[0];

      const songUrl: string | undefined = match?.result?.url;
      const songId: number | undefined = match?.result?.id;
      if (!songUrl || !songId) {
        throw new Error(`[lyrics] Genius result missing song URL/ID for query="${searchQuery}" (artist="${artist}", title="${songTitle}").`);
      }

      // 2) Try the Genius web JSON lyrics endpoint first
      const jsonAttempt = await tryGeniusLyricsJson(songId);
      if (jsonAttempt.lyrics) {
        return jsonAttempt.lyrics;
      }

      // 3) Fetch the page HTML (fallback)
      const pageResponse = await fetch(songUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://genius.com/",
        },
        redirect: "follow",
      });

      let html: string | null = null;
      if (pageResponse.ok) {
        html = await pageResponse.text();
      } else {
        let proxyStatus: number | string = "n/a";
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
          proxyStatus = proxyResp.status;
          if (proxyResp.ok) {
            const text = await proxyResp.text();
            const cleaned = text?.trim();
            if (cleaned) {
              return cleaned;
            }
          }
        } catch {
          proxyStatus = "error";
        }
        const hint = pageResponse.status === 403 || pageResponse.status === 503 ? " Likely blocked by anti-bot (e.g., Cloudflare)." : "";
        throw new Error(`[lyrics] Could not load lyrics page: direct status ${pageResponse.status}, proxy status ${proxyStatus}. url=${songUrl}.${hint} Attempts: ${jsonAttempt.status}${jsonAttempt.proxyStatus ? ", proxy=" + jsonAttempt.proxyStatus : ""}.`);
      }

      // 4) Extract from HTML
      const lyrics = html ? extractLyricsFromHtml(html) : null;

      if (!lyrics) {
        // Try proxy even if direct fetch succeeded but extraction failed
        let proxyStatus: number | string = "n/a";
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
          proxyStatus = proxyResp.status;
          if (proxyResp.ok) {
            const text = await proxyResp.text();
            const cleaned = text?.trim();
            if (cleaned) {
              return cleaned;
            }
          }
        } catch {
          proxyStatus = "error";
        }
        throw new Error(`[lyrics] Unable to extract lyrics from page structure. url=${songUrl} htmlLength=${html?.length ?? 0}. Proxy attempt status ${proxyStatus}. Attempts: ${jsonAttempt.status}.`);
      }
      return lyrics;
    } catch (err) {
      console.error("Error fetching/scraping lyrics:", err);
      throw new Error(typeof err === "string" ? err : (err as Error)?.message || "Could not retrieve lyrics at this time.");
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
