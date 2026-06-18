import { runActorAndGetResults, APIFY_ACTORS } from "../client";
import type { RawPostData } from "@/types";
import crypto from "crypto";

const INDUSTRIAL_SUBREDDITS = [
  "manufacturing",
  "mechanical_engineering",
  "industrialengineering",
  "PLC",                      // industrial PLC/SCADA, not software
  "robotics",
  "CNC",
  "metalworking",
  "machining",
  "welding",
  "CAD",
  "procurement",
  "supplychain",
  "smallbusiness",
  "Entrepreneur",
  "manufacturing_industry",
  "lean",
  "qualityassurance",
  "HVAC",
  "hydraulics",
  "pneumatics",
  "packaging",
  "foodscience",
  "chemicalengineering",
];

export interface RedditScrapeConfig {
  subreddits?: string[];
  searchTerms?: string[];
  maxPosts?: number;
  dateFrom?: string;
}

// All search terms are scoped to specific industrial subreddits to avoid noise
const DEFAULT_SEARCH_TERMS = [
  { subreddit: "manufacturing", term: "supplier OR manufacturer OR RFQ OR sourcing" },
  { subreddit: "manufacturing", term: "looking for OR need OR find OR recommend" },
  { subreddit: "mechanical_engineering", term: "supplier OR manufacturer OR fabrication OR machining" },
  { subreddit: "CNC", term: "shop OR supplier OR quote OR recommend" },
  { subreddit: "metalworking", term: "supplier OR fabrication OR shop OR quote" },
  { subreddit: "automation", term: "integrator OR solution OR vendor OR supplier" },
  { subreddit: "PLC", term: "integrator OR solution OR vendor OR supplier" },
  { subreddit: "robotics", term: "integrator OR supplier OR solution" },
  { subreddit: "smallbusiness", term: "manufacturer OR supplier OR fabrication OR contract manufacturing" },
  { subreddit: "Entrepreneur", term: "manufacturer OR supplier OR contract manufacturing OR OEM" },
  { subreddit: "supplychain", term: "supplier OR sourcing OR manufacturer OR RFQ" },
  { subreddit: "procurement", term: "supplier OR manufacturer OR RFQ OR quote" },
  { subreddit: "machining", term: "shop OR supplier OR quote OR recommend" },
  { subreddit: "engineering", term: "supplier OR manufacturer OR fabrication OR contractor" },
];

function hashContent(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

function parseRedditPost(item: Record<string, unknown>): RawPostData | null {
  // trudax/reddit-scraper-lite field names: id, parsedId, url, username, title, communityName, body, createdAt, numberOfComments, score
  const id = (item.parsedId ?? item.id ?? item.postId) as string | undefined;
  const url = (item.url as string) ?? `https://reddit.com${(item.permalink as string) ?? ""}`;
  const content = ((item.body as string) ?? (item.selftext as string) ?? (item.text as string) ?? "").trim();
  const title = (item.title as string) ?? "";

  if (!id || (!content && !title)) return null;

  const fullContent = title ? `${title}\n\n${content}` : content;
  if (fullContent.length < 30) return null;

  const author = (item.username as string) ?? (item.author as string) ?? "unknown";

  return {
    externalId: String(id),
    platform: "REDDIT",
    url,
    title,
    content: fullContent,
    author,
    authorUrl: author !== "unknown" ? `https://reddit.com/u/${author}` : undefined,
    subreddit: (item.communityName as string) ?? (item.parsedCommunityName as string) ?? (item.subreddit as string),
    upvotes: (item.score as number) ?? (item.upvotes as number) ?? 0,
    comments: (item.numberOfComments as number) ?? (item.numComments as number) ?? 0,
    postedAt: item.createdAt
      ? new Date(item.createdAt as string)
      : item.created_utc
      ? new Date((item.created_utc as number) * 1000)
      : undefined,
    rawData: item,
  };
}

function parseRedditComment(item: Record<string, unknown>): RawPostData | null {
  const id = (item.id as string) ?? (item.commentId as string);
  const body = ((item.body as string) ?? "").trim();

  if (!id || body.length < 50) return null;

  const postUrl = (item.postUrl as string) ?? "";
  const url = item.url as string ?? postUrl;

  return {
    externalId: `comment_${id}`,
    platform: "REDDIT",
    url: url || postUrl,
    title: `Comment on: ${(item.postTitle as string) ?? ""}`,
    content: body,
    author: (item.author as string) ?? "unknown",
    authorUrl: item.author ? `https://reddit.com/u/${item.author}` : undefined,
    subreddit: (item.communityName as string) ?? (item.subreddit as string),
    upvotes: (item.score as number) ?? 0,
    comments: 0,
    postedAt: item.createdAt
      ? new Date(item.createdAt as string)
      : undefined,
    rawData: item,
  };
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isWithinLastDays(item: Record<string, unknown>, days = 3): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const ts =
    item.createdAt
      ? new Date(item.createdAt as string).getTime()
      : item.created_utc
      ? (item.created_utc as number) * 1000
      : null;
  // If no timestamp, include it (let DB dedup handle later)
  if (ts === null) return true;
  return ts >= cutoff;
}

export async function scrapeReddit(
  config: RedditScrapeConfig = {}
): Promise<RawPostData[]> {
  const subreddits = config.subreddits ?? INDUSTRIAL_SUBREDDITS.slice(0, 8);
  const maxPosts = config.maxPosts ?? 50;

  const results: RawPostData[] = [];
  const seen = new Set<string>();

  // Strategy 1: Scrape /new/ on targeted industrial subreddits directly
  for (const subreddit of subreddits.slice(0, 6)) {
    try {
      const items = await runActorAndGetResults({
        actorId: APIFY_ACTORS.REDDIT_SCRAPER,
        input: {
          startUrls: [{ url: `https://www.reddit.com/r/${subreddit}/new/` }],
          maxItems: Math.min(maxPosts, 20),
          proxy: { useApifyProxy: true },
        },
      });

      for (const item of items) {
        if (!isWithinLastDays(item, 3)) continue;
        const post = parseRedditPost(item);
        if (post && !seen.has(post.externalId)) {
          seen.add(post.externalId);
          results.push(post);
        }
      }
    } catch (err) {
      console.error(`Failed to scrape r/${subreddit}:`, err);
    }
  }

  // Strategy 2: Subreddit-scoped searches — keeps results on-topic
  for (const { subreddit, term } of DEFAULT_SEARCH_TERMS.slice(0, 6)) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(term)}&sort=new&t=week&restrict_sr=1`;
      const items = await runActorAndGetResults({
        actorId: APIFY_ACTORS.REDDIT_SCRAPER,
        input: {
          startUrls: [{ url }],
          maxItems: 20,
          proxy: { useApifyProxy: true },
        },
      });

      for (const item of items) {
        if (!isWithinLastDays(item, 3)) continue;
        const post = parseRedditPost(item);
        if (post && !seen.has(post.externalId)) {
          seen.add(post.externalId);
          results.push(post);
        }
      }
    } catch (err) {
      console.error(`Failed subreddit search r/${subreddit} for "${term}":`, err);
    }
  }

  return results;
}

export async function scrapeRedditComments(
  postUrls: string[]
): Promise<RawPostData[]> {
  const results: RawPostData[] = [];

  try {
    const items = await runActorAndGetResults({
      actorId: APIFY_ACTORS.REDDIT_COMMENTS,
      input: {
        startUrls: postUrls.map((url) => ({ url })),
        maxItems: 200,
        includeComments: true,
        proxy: { useApifyProxy: true },
      },
      timeoutSecs: 180,
    });

    for (const item of items) {
      if (item.type === "comment") {
        const comment = parseRedditComment(item);
        if (comment) results.push(comment);
      }
    }
  } catch (err) {
    console.error("Failed to scrape Reddit comments:", err);
  }

  return results;
}

export { INDUSTRIAL_SUBREDDITS };
