/**
 * Reddit scraper using Nimble Extract API.
 *
 * Mirrors the approach in reddit_manufacturing_scraper.py:
 *   - POST https://sdk.nimbleway.com/v1/extract with Bearer auth
 *   - Hits Reddit's search.json endpoints (sort=new, t=week, restrict_sr=1)
 *   - Paginates up to MAX_PAGES per subreddit
 *   - Keyword pre-filter then AI qualification
 */

import { nimbleFetchUrl } from "../client";
import type { RawPostData } from "@/types";
import crypto from "crypto";

const LOOKBACK_DAYS = 7;
const LOOKBACK_SECONDS = LOOKBACK_DAYS * 86400;
const MAX_PAGES = 3;
const PAGE_LIMIT = 100;
const REQUEST_PAUSE_MS = 1000;

// Matches the Python script's subreddit list (expanded for industrial buyers)
export const INDUSTRIAL_SUBREDDITS = [
  // Core manufacturing / fabrication
  "manufacturing", "Machinists", "CNC", "machining", "metalworking",
  "Welding", "SheetMetal", "Fabrication", "InjectionMolding", "plastics",
  "3Dprinting", "PrintedCircuitBoard", "PCB", "Casting", "Hydraulics",
  // Engineering / buyer side
  "AskEngineers", "MechanicalEngineering", "engineering", "hardware",
  "PLC", "robotics", "automation", "HVAC", "pneumatics",
  // Sourcing / small business
  "sourcing", "AlibabaSourcing", "smallbusiness", "Entrepreneur",
  "procurement", "supplychain",
  // Equipment & tools (standard product buyers)
  "Tools", "handtools", "woodworking", "Plumbing", "electricians",
  "HVAC", "farming", "agriculture", "construction",
  // Industry-specific
  "oilandgas", "mining", "aerospace", "automotive", "food",
  "packaging", "chemicalengineering", "industrialengineering",
  // Repair & maintenance (replacement part buyers)
  "MechanicAdvice", "diyelectronics", "appliancerepair",
  // Facility / operations managers
  "facilities", "buildingmanagement",
];

// Broad search query — catches buyers of any industrial product (standard or custom)
const SEARCH_QUERY =
  'quote OR RFQ OR supplier OR manufacturer OR sourcing OR MOQ OR ' +
  '"machine shop" OR "custom parts" OR "looking for" OR fabricate OR ' +
  '"where to buy" OR "where can i buy" OR "best place to buy" OR ' +
  '"need to buy" OR "looking to buy" OR "want to buy" OR "purchase" OR ' +
  '"distributor" OR "where to find" OR "recommend" OR "pricing" OR ' +
  '"how much does" OR "cost of" OR "replacement" OR "spare parts"';

// Broad intent keywords — includes standard product buyers, not just custom
const INTENT_KEYWORDS = [
  // Direct purchase intent
  "where to buy", "where can i buy", "best place to buy", "looking to buy",
  "want to buy", "need to buy", "trying to buy", "looking to purchase",
  "where do i buy", "how do i buy", "can i buy", "where to get",
  "where can i get", "how to get", "where to find", "where do i find",
  // Supplier/vendor search
  "supplier", "distributor", "vendor", "dealer", "reseller",
  "looking for a supplier", "need a supplier", "find a supplier",
  "supplier recommendation", "recommend a supplier", "suggest a supplier",
  "looking for a manufacturer", "need a manufacturer",
  // Pricing/quotes
  "quote", "rfq", "request for quote", "pricing", "how much does",
  "how much is", "cost of", "price of", "what does it cost",
  "moq", "minimum order",
  // Sourcing
  "sourcing", "source from", "looking to source", "looking to have",
  "where to source",
  // Replacement/repair parts (standard SKU buyers)
  "replacement", "spare part", "spare parts", "replacement part",
  "where to find parts", "need parts", "looking for parts",
  // Manufacturing services
  "machine shop", "fabricate", "fabrication", "custom parts", "custom part",
  "manufacturer recommendation", "contract manufacturing", "outsource",
  "small batch", "low volume", "prototype run", "made to order",
  // General buying signals
  "recommend", "anyone know where", "anyone know of", "looking for",
  "need help finding", "help me find", "who sells", "who makes",
  "who can supply", "anyone sell",
];

function hashContent(content: string): string {
  return crypto.createHash("md5").update(content.trim().toLowerCase()).digest("hex");
}

function matchedKeywords(title: string, body: string): string[] {
  const text = `${title} ${body}`.toLowerCase();
  return INTENT_KEYWORDS.filter((kw) => text.includes(kw));
}

function isRecent(createdUtc: number): boolean {
  return Date.now() / 1000 - createdUtc <= LOOKBACK_SECONDS;
}

async function fetchSubredditPage(
  subreddit: string,
  after?: string
): Promise<{ posts: RedditPost[]; nextAfter?: string }> {
  const q = encodeURIComponent(SEARCH_QUERY);
  let url =
    `https://www.reddit.com/r/${subreddit}/search.json` +
    `?q=${q}&restrict_sr=1&sort=new&t=week&limit=${PAGE_LIMIT}`;
  if (after) url += `&after=${after}`;

  const raw = await nimbleFetchUrl(url);

  let json: RedditListing;
  try {
    json = JSON.parse(raw) as RedditListing;
  } catch {
    return { posts: [] };
  }

  const children = json?.data?.children ?? [];
  const posts = children
    .filter((c) => c.kind === "t3")
    .map((c) => c.data as RedditPost);

  return {
    posts,
    nextAfter: json?.data?.after ?? undefined,
  };
}

async function scrapeSubreddit(subreddit: string): Promise<RawPostData[]> {
  const results: RawPostData[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    let posts: RedditPost[];
    let nextAfter: string | undefined;

    try {
      ({ posts, nextAfter } = await fetchSubredditPage(subreddit, after));
    } catch (err) {
      console.error(`[Nimble] r/${subreddit} page ${page}: ${err}`);
      break;
    }

    if (!posts.length) break;

    let hitOldPost = false;
    for (const post of posts) {
      if (post.created_utc && !isRecent(post.created_utc)) {
        hitOldPost = true;
        continue;
      }

      // Keyword pre-filter (mirrors Python's matched_keywords)
      const kws = matchedKeywords(post.title ?? "", post.selftext ?? "");
      if (!kws.length) continue;

      const raw = toRawPost(post, subreddit, kws);
      if (raw) results.push(raw);
    }

    after = nextAfter;
    if (hitOldPost || !after) break;

    await sleep(REQUEST_PAUSE_MS);
  }

  return results;
}

function toRawPost(
  post: RedditPost,
  subreddit: string,
  matchedKws: string[]
): RawPostData | null {
  const id = post.id ?? post.name;
  const title = post.title ?? "";
  const body = post.selftext ?? "";
  const fullContent = body ? `${title}\n\n${body}` : title;

  if (!id || fullContent.length < 30) return null;

  return {
    externalId: post.name ?? id,
    platform: "REDDIT",
    url: post.url ?? `https://www.reddit.com${post.permalink ?? ""}`,
    title,
    content: fullContent,
    author: post.author ?? "unknown",
    authorUrl: post.author ? `https://reddit.com/u/${post.author}` : undefined,
    subreddit: post.subreddit ?? subreddit,
    upvotes: post.score ?? 0,
    comments: post.num_comments ?? 0,
    postedAt: post.created_utc ? new Date(post.created_utc * 1000) : undefined,
    rawData: {
      ...(post as unknown as Record<string, unknown>),
      matched_keywords: matchedKws,
      content_hash: hashContent(fullContent),
    },
  };
}

export interface RedditScrapeConfig {
  subreddits?: string[];
  maxPostsPerSubreddit?: number;
}

export async function scrapeRedditWithNimble(
  config: RedditScrapeConfig = {}
): Promise<RawPostData[]> {
  const subreddits = config.subreddits ?? INDUSTRIAL_SUBREDDITS;
  const results: RawPostData[] = [];
  const seen = new Set<string>();

  for (const subreddit of subreddits) {
    try {
      const posts = await scrapeSubreddit(subreddit);
      let kept = 0;
      for (const post of posts) {
        if (!seen.has(post.externalId)) {
          seen.add(post.externalId);
          results.push(post);
          kept++;
        }
      }
      console.log(`[Nimble] r/${subreddit}: ${kept} candidates`);
    } catch (err) {
      console.error(`[Nimble] Failed r/${subreddit}:`, err);
    }
    await sleep(REQUEST_PAUSE_MS);
  }

  console.log(`[Nimble] Total candidates: ${results.length}`);
  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Reddit JSON API types ---

interface RedditListing {
  data: {
    children: Array<{ kind: string; data: RedditPost | RedditComment }>;
    after?: string | null;
    before?: string | null;
  };
}

interface RedditPost {
  id?: string;
  name?: string;
  title?: string;
  selftext?: string;
  url?: string;
  permalink?: string;
  author?: string;
  subreddit?: string;
  score?: number;
  num_comments?: number;
  created_utc?: number;
  link_flair_text?: string;
}

interface RedditComment {
  id?: string;
  body?: string;
  author?: string;
  subreddit?: string;
  score?: number;
  created_utc?: number;
  permalink?: string;
}
