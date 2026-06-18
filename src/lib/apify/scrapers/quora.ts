// Quora's public scraper is unavailable on this Apify plan.
// This module uses Reddit's broader search as a replacement,
// targeting procurement/sourcing discussions across all subreddits.
import { runActorAndGetResults, APIFY_ACTORS } from "../client";
import type { RawPostData } from "@/types";

const PROCUREMENT_SEARCH_TERMS = [
  "looking for a manufacturer site:reddit.com",
  "need a supplier site:reddit.com",
  "find contract manufacturer",
  "recommend CNC machining shop",
  "injection molding supplier recommendation",
  "custom fabrication vendor",
  "automation integrator recommendation",
  "OEM parts supplier needed",
  "sheet metal fab shop recommendation",
];

// Scoped to industrial subreddits to avoid off-topic results
const BROAD_REDDIT_SEARCH_TERMS = [
  { subreddit: "manufacturing", term: "looking for manufacturer OR contract manufacturer OR outsource" },
  { subreddit: "Entrepreneur", term: "manufacturer OR supplier OR contract manufacturing OR OEM OR fabrication" },
  { subreddit: "smallbusiness", term: "manufacturer OR supplier OR contract manufacturing OR fabrication" },
  { subreddit: "supplychain", term: "supplier OR sourcing OR RFQ OR manufacturer" },
  { subreddit: "engineering", term: "supplier OR vendor OR fabrication OR machining OR contractor" },
];

function daysAgoDate(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

function isWithinLastDays(item: Record<string, unknown>, days = 3): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const raw = item.createdAt ?? item.date ?? item.postedAt;
  if (!raw) return true;
  return new Date(raw as string).getTime() >= cutoff;
}

function parseItem(item: Record<string, unknown>): RawPostData | null {
  const id = (item.parsedId ?? item.id) as string | undefined;
  const url = item.url as string;
  const content = ((item.body as string) ?? (item.selftext as string) ?? "").trim();
  const title = (item.title as string) ?? "";

  if (!id || (!content && !title)) return null;
  const fullContent = title ? `${title}\n\n${content}` : content;
  if (fullContent.length < 30) return null;

  const author = (item.username as string) ?? (item.author as string) ?? "unknown";

  return {
    externalId: String(id),
    platform: "QUORA",  // labeled as QUORA slot but sourced from Reddit broad search
    url,
    title,
    content: fullContent,
    author,
    authorUrl: author !== "unknown" ? `https://reddit.com/u/${author}` : undefined,
    subreddit: (item.communityName as string) ?? (item.parsedCommunityName as string),
    upvotes: (item.score as number) ?? 0,
    comments: (item.numberOfComments as number) ?? 0,
    postedAt: item.createdAt ? new Date(item.createdAt as string) : undefined,
    rawData: item,
  };
}

export async function scrapeQuora(config?: {
  searchTerms?: string[];
  maxItems?: number;
}): Promise<RawPostData[]> {
  const searchTerms = config?.searchTerms ?? BROAD_REDDIT_SEARCH_TERMS.slice(0, 5);
  const maxItems = config?.maxItems ?? 30;
  const since = daysAgoDate(3);
  const results: RawPostData[] = [];
  const seen = new Set<string>();

  for (const entry of BROAD_REDDIT_SEARCH_TERMS) {
    const { subreddit, term } = typeof entry === "string"
      ? { subreddit: "manufacturing", term: entry }
      : entry as { subreddit: string; term: string };
    try {
      const url = `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(term)}&sort=new&t=week&restrict_sr=1`;
      const items = await runActorAndGetResults({
        actorId: APIFY_ACTORS.REDDIT_SCRAPER,
        input: {
          startUrls: [{ url }],
          maxItems,
          proxy: { useApifyProxy: true },
        },
      });

      for (const item of items) {
        if (!isWithinLastDays(item, 3)) continue;
        const post = parseItem(item);
        if (post && !seen.has(post.externalId)) {
          seen.add(post.externalId);
          results.push(post);
        }
      }
    } catch (err) {
      console.error(`Broad Reddit search failed for "${subreddit}/${term}":`, err);
    }
  }

  return results;
}
