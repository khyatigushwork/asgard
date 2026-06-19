/**
 * Multi-platform crawl orchestrator.
 * Reddit  → Nimble API
 * LinkedIn → OutX API
 */

import { scrapeRedditWithNimble } from "./scrapers/reddit";
import { scrapeLinkedInWithOutX } from "../outx/scrapers/linkedin";
import { saveRawPosts, checkDuplicate } from "../db/posts";
import type { RawPostData, Platform } from "@/types";
import crypto from "crypto";

export interface CrawlOptions {
  platforms?: Platform[];
  maxPerPlatform?: number;
  searchTerms?: string[];
  crawlJobId?: string;
  sourceId?: string;
}

export interface CrawlResult {
  platform: Platform;
  fetched: number;
  saved: number;
  duplicates: number;
  errors: string[];
}

function hashContent(content: string): string {
  return crypto.createHash("md5").update(content.trim().toLowerCase()).digest("hex");
}

async function deduplicateAndSave(
  posts: RawPostData[],
  crawlJobId?: string,
  sourceId?: string
): Promise<{ saved: number; duplicates: number }> {
  let saved = 0;
  let duplicates = 0;

  for (const post of posts) {
    const contentHash = hashContent(post.content);
    const isDuplicate = await checkDuplicate(post.platform, post.externalId, contentHash);

    if (isDuplicate) {
      duplicates++;
      continue;
    }

    await saveRawPosts(
      [{ ...post, rawData: { ...(post.rawData ?? {}), contentHash } }],
      crawlJobId,
      sourceId
    );
    saved++;
  }

  return { saved, duplicates };
}

export async function runCrawl(options: CrawlOptions = {}): Promise<CrawlResult[]> {
  const platforms = options.platforms ?? ["REDDIT"];
  const results: CrawlResult[] = [];

  for (const platform of platforms) {
    const result: CrawlResult = {
      platform,
      fetched: 0,
      saved: 0,
      duplicates: 0,
      errors: [],
    };

    try {
      let posts: RawPostData[] = [];

      switch (platform) {
        case "REDDIT":
          posts = await scrapeRedditWithNimble({
            maxPostsPerSubreddit: options.maxPerPlatform ?? 100,
          });
          break;

        case "LINKEDIN":
          posts = await scrapeLinkedInWithOutX({
            daysBack: 7,
            maxPerWatchlist: options.maxPerPlatform ?? 100,
          });
          break;

        // Future platforms
        case "QUORA":
        case "TWITTER":
        case "INDUSTRY_FORUMS":
        case "THOMASNET":
        case "ENGINEERING_STACK":
        case "OTHER":
          result.errors.push(`Platform ${platform} not yet supported. Coming soon.`);
          break;

        default:
          result.errors.push(`Unknown platform: ${platform}`);
      }

      result.fetched = posts.length;

      if (posts.length > 0) {
        const { saved, duplicates } = await deduplicateAndSave(
          posts,
          options.crawlJobId,
          options.sourceId
        );
        result.saved = saved;
        result.duplicates = duplicates;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      console.error(`[Nimble] Crawl failed for ${platform}:`, err);
    }

    results.push(result);
  }

  return results;
}
