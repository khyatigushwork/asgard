/**
 * LinkedIn scraper using OutX API.
 *
 * OutX workflow:
 *   1. POST /api-keyword-watchlist  — create a watchlist per query group
 *   2. GET  /api-posts              — retrieve posts from the last 7 days
 *
 * We group the 50 queries into 5 watchlists (10 queries each) to stay
 * within API limits while maximising coverage.
 */

import { createOrGetWatchlist, fetchWatchlistPosts, type OutXPost } from "../client";
import type { RawPostData } from "@/types";
import crypto from "crypto";

const REQUEST_PAUSE_MS = 1500;

// 50 buyer-intent queries grouped into 5 watchlists of 10
const WATCHLIST_GROUPS: Array<{ name: string; keywords: string[] }> = [
  {
    name: "IBD_Sourcing_Procurement",
    keywords: [
      "looking for supplier industrial equipment",
      "sourcing manufacturer quote RFQ",
      "need supplier machinery parts",
      "looking for vendor industrial",
      "request for quote manufacturing",
      "procurement industrial equipment supplier",
      "supplier recommendation industrial",
      "where to source industrial parts",
      "need to find manufacturer",
      "looking for OEM supplier",
    ],
  },
  {
    name: "IBD_Equipment_Buying",
    keywords: [
      "looking to buy industrial equipment",
      "purchasing machinery equipment",
      "comparing suppliers manufacturing",
      "evaluating vendors industrial",
      "need recommendation equipment supplier",
      "which supplier do you recommend",
      "best supplier for industrial",
      "looking to purchase industrial machinery",
      "buying new equipment for factory",
      "shortlisting vendors for equipment",
    ],
  },
  {
    name: "IBD_Operational_Problems",
    keywords: [
      "equipment breakdown replacement parts",
      "production line upgrade equipment",
      "expanding manufacturing capacity",
      "new facility equipment installation",
      "automation solution looking for",
      "replacing old machinery",
      "upgrading production equipment",
      "need spare parts urgently",
      "machine stopped working need replacement",
      "plant expansion new equipment needed",
    ],
  },
  {
    name: "IBD_Product_Categories",
    keywords: [
      "CNC machining supplier quote",
      "hydraulic equipment supplier",
      "conveyor system supplier",
      "welding equipment supplier",
      "compressor supplier industrial",
      "pump supplier industrial",
      "PLC automation supplier",
      "robotics automation solution",
      "packaging equipment supplier",
      "HVAC industrial supplier",
    ],
  },
  {
    name: "IBD_Industry_Specific",
    keywords: [
      "injection molding supplier",
      "sheet metal fabrication supplier",
      "industrial motor supplier",
      "bearing supplier industrial",
      "valve supplier industrial",
      "pressure vessel supplier",
      "heat exchanger supplier",
      "electrical panel supplier",
      "forklift supplier warehouse",
      "crane lifting equipment supplier",
    ],
  },
];

// Intent keywords for post-filter
const INTENT_KEYWORDS = [
  "looking for", "need a supplier", "need supplier", "sourcing",
  "where to buy", "where can i", "recommend", "recommendation",
  "rfq", "request for quote", "quote", "pricing", "price",
  "supplier", "manufacturer", "vendor", "distributor",
  "looking to buy", "want to buy", "purchasing", "procurement",
  "replacement", "spare parts", "upgrade", "install",
  "evaluate", "compare", "shortlist", "selection",
];

function hashContent(content: string): string {
  return crypto.createHash("md5").update(content.trim().toLowerCase()).digest("hex");
}

function matchedKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return INTENT_KEYWORDS.filter((kw) => lower.includes(kw));
}

function dateNDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().split("T")[0];
}

function toRawPost(post: OutXPost, matchedKws: string[]): RawPostData | null {
  const id = post.id ?? post.urn;
  // content field is used; fall back to text
  const text = post.content ?? post.text ?? "";
  if (!id || text.length < 30) return null;

  // linkedin_post_url is a slug — build the full URL
  const slug = post.linkedin_post_url;
  const postUrl =
    post.url ||
    (slug ? `https://www.linkedin.com/feed/update/urn:li:activity:${slug.split("-activity-")[1]?.split("-")[0] ?? slug}` : "") ||
    (post.urn ? `https://www.linkedin.com/feed/update/${post.urn}` : "");
  if (!postUrl) return null;

  const postedAt = post.post_date ?? post.posted_at ?? post.created_at;
  const authorName = post.author?.name ?? post.author_name ?? "unknown";
  const authorUrl = post.author?.profile_url ?? post.author_linkedin_url;
  const authorHeadline = post.author?.headline ?? post.author_headline;
  const companyName = post.company?.name ?? post.company_name ?? post.author?.company;

  return {
    externalId: id,
    platform: "LINKEDIN",
    url: postUrl,
    title: undefined,
    content: text,
    author: authorName,
    authorUrl,
    subreddit: undefined,
    upvotes: post.likes ?? post.num_likes ?? 0,
    comments: post.comments ?? post.num_comments ?? 0,
    postedAt: postedAt ? new Date(postedAt) : undefined,
    rawData: {
      ...(post as unknown as Record<string, unknown>),
      matched_keywords: matchedKws,
      content_hash: hashContent(text),
      author_headline: authorHeadline,
      author_company: companyName,
    },
  };
}

export interface LinkedInScrapeConfig {
  daysBack?: number;
  maxPerWatchlist?: number;
}

// Existing watchlist IDs (free plan = 2 max). These are fetched at runtime.
// The scraper will: 1) try to create each group's watchlist, 2) fall back to
// any existing ones if the plan limit is hit, 3) fetch all available posts.
export async function scrapeLinkedInWithOutX(
  config: LinkedInScrapeConfig = {}
): Promise<RawPostData[]> {
  const daysBack = config.daysBack ?? 7;
  const maxPerWatchlist = config.maxPerWatchlist ?? 100;
  const dateFrom = dateNDaysAgo(daysBack);
  const dateTo = new Date().toISOString().split("T")[0];

  const results: RawPostData[] = [];
  const seen = new Set<string>();
  const watchlistIds: string[] = [];

  // Step 1: create watchlists (gracefully handle plan limit)
  for (const group of WATCHLIST_GROUPS) {
    try {
      console.log(`[OutX] Creating watchlist: ${group.name}`);
      const watchlist = await createOrGetWatchlist({
        name: group.name,
        keywords: group.keywords,
        fetchFreqInHours: 6,
      });
      watchlistIds.push(watchlist.id);
      console.log(`[OutX] Watchlist id=${watchlist.id} created=${watchlist.created}`);
      await new Promise((r) => setTimeout(r, REQUEST_PAUSE_MS));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? String(err);
      if (msg.includes("plan includes up to")) {
        console.log(`[OutX] Plan limit reached — fetching from existing watchlists only`);
        break;
      }
      console.error(`[OutX] Failed to create watchlist "${group.name}":`, msg);
    }
  }

  // Step 2: also discover any pre-existing watchlists via list endpoint
  try {
    const { listWatchlists } = await import("../client");
    const existing = await listWatchlists();
    for (const w of existing) {
      if (!watchlistIds.includes(w.id)) {
        watchlistIds.push(w.id);
        console.log(`[OutX] Found existing watchlist id=${w.id} name=${w.name}`);
      }
    }
  } catch {
    // list endpoint may not exist — skip
  }

  // Step 3: fetch posts from every watchlist we have access to
  for (const wId of watchlistIds) {
    try {
      const posts = await fetchWatchlistPosts({
        watchlist_id: wId,
        start_date: dateFrom,
        end_date: dateTo,
        sort_by: "recent",
        page_size: maxPerWatchlist,
      });

      let kept = 0;
      for (const post of posts) {
        const id = post.id ?? post.urn ?? post.linkedin_post_url;
        if (!id || seen.has(id)) continue;

        // Broader content match — LinkedIn posts often have implicit intent
        const content = post.content ?? post.text ?? "";
        const kws = matchedKeywords(content);
        // Accept posts even with minimal keyword match (1 keyword) since
        // they already passed OutX watchlist filtering
        if (!kws.length && content.length < 100) continue;

        const raw = toRawPost(post, kws);
        if (raw) {
          seen.add(id);
          results.push(raw);
          kept++;
        }
      }

      console.log(`[OutX] Watchlist ${wId}: ${posts.length} posts fetched, ${kept} added`);
    } catch (err) {
      console.error(`[OutX] Failed to fetch posts for watchlist ${wId}:`, err);
    }

    await new Promise((r) => setTimeout(r, REQUEST_PAUSE_MS));
  }

  console.log(`[OutX] Total LinkedIn candidates: ${results.length}`);
  return results;
}
