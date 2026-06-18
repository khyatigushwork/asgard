import { runActorAndGetResults, APIFY_ACTORS } from "../client";
import type { RawPostData } from "@/types";

const TWITTER_SEARCH_QUERIES = [
  "looking for manufacturer OR supplier industrial -job -hiring",
  "need custom fabrication machining quote",
  "RFQ manufacturer OR supplier",
  "automation solution needed OR required",
  "contract manufacturing OR OEM supplier needed",
  "CNC machining supplier recommendation",
  "injection molding supplier needed",
  "industrial equipment supplier",
  "engineering services needed",
  "procurement industrial parts supplier",
];

function parseTwitterItem(item: Record<string, unknown>): RawPostData | null {
  const id = (item.id ?? item.tweetId) as string | undefined;
  // apidojo/tweet-scraper returns fullText as the complete tweet text
  const text = ((item.fullText ?? item.text ?? item.full_text ?? item.content) as string)?.trim();

  if (!id || !text || text.length < 30) return null;

  const username = (item.author as Record<string, unknown>)?.userName as string ??
    (item.author as Record<string, unknown>)?.username as string ??
    (item.userName as string) ??
    (item.username as string);

  return {
    externalId: String(id),
    platform: "TWITTER",
    url: `https://twitter.com/${username}/status/${id}`,
    content: text,
    author: username,
    authorUrl: username ? `https://twitter.com/${username}` : undefined,
    upvotes: (item.likeCount as number) ?? (item.favorite_count as number) ?? 0,
    comments: (item.replyCount as number) ?? (item.reply_count as number) ?? 0,
    views: (item.viewCount as number) ?? 0,
    shares: (item.retweetCount as number) ?? (item.retweet_count as number) ?? 0,
    postedAt: item.createdAt
      ? new Date(item.createdAt as string)
      : item.created_at
      ? new Date(item.created_at as string)
      : undefined,
    rawData: item,
  };
}

function isWithinLastDays(item: Record<string, unknown>, days = 3): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const raw = item.createdAt ?? item.created_at;
  if (!raw) return true;
  return new Date(raw as string).getTime() >= cutoff;
}

// Returns Twitter's date string for N days ago: "YYYY-MM-DD"
function daysAgoDate(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

export async function scrapeTwitter(config?: {
  searchTerms?: string[];
  maxTweets?: number;
}): Promise<RawPostData[]> {
  const searchTerms = config?.searchTerms ?? TWITTER_SEARCH_QUERIES.slice(0, 5);
  const maxTweets = config?.maxTweets ?? 50;
  const since = daysAgoDate(3);
  const results: RawPostData[] = [];
  const seen = new Set<string>();

  for (const query of searchTerms) {
    try {
      const items = await runActorAndGetResults({
        actorId: APIFY_ACTORS.TWITTER_SEARCH,
        input: {
          searchTerms: [`${query} since:${since}`],
          maxTweets,
          queryType: "Latest",
          lang: "en",
          proxy: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
        },
        timeoutSecs: 120,
      });

      for (const item of items) {
        if (!isWithinLastDays(item, 3)) continue;
        const post = parseTwitterItem(item);
        if (post && !seen.has(post.externalId)) {
          seen.add(post.externalId);
          results.push(post);
        }
      }
    } catch (err) {
      console.error(`Failed to scrape Twitter for "${query}":`, err);
    }
  }

  return results;
}
