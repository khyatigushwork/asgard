import { runActorAndGetResults, APIFY_ACTORS } from "../client";
import type { RawPostData } from "@/types";

// Public industrial forums and communities
const INDUSTRIAL_FORUM_URLS = [
  // Engineering forums
  "https://www.eng-tips.com/threadminder.cfm?pid=780",
  "https://www.eng-tips.com/threadminder.cfm?pid=220",
  // Practical Machinist
  "https://www.practicalmachinist.com/forum/",
  // The Fabricator
  "https://www.thefabricator.com/thefabricator/forum/",
  // CNC Zone
  "https://www.cnczone.com/forums/",
];

function parseForumItem(
  item: Record<string, unknown>,
  source: string
): RawPostData | null {
  const url = (item.url as string) ?? "";
  const title = (item.title as string) ?? "";
  const content = (
    (item.text as string) ??
    (item.content as string) ??
    (item.body as string) ??
    ""
  ).trim();

  if (!url || (!content && !title)) return null;
  if (content.length < 50 && title.length < 20) return null;

  const id = url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 100);

  return {
    externalId: id,
    platform: "INDUSTRY_FORUMS",
    url,
    title,
    content: title ? `${title}\n\n${content}` : content,
    author: (item.author as string) ?? (item.username as string),
    upvotes: (item.likes as number) ?? (item.upvotes as number) ?? 0,
    comments: (item.replies as number) ?? (item.comments as number) ?? 0,
    views: (item.views as number) ?? 0,
    postedAt: item.date ? new Date(item.date as string) : undefined,
    rawData: { ...item, source },
  };
}

export async function scrapeIndustrialForums(config?: {
  urls?: string[];
  maxItems?: number;
}): Promise<RawPostData[]> {
  const urls = config?.urls ?? INDUSTRIAL_FORUM_URLS;
  const maxItems = config?.maxItems ?? 30;
  const results: RawPostData[] = [];
  const seen = new Set<string>();

  try {
    const items = await runActorAndGetResults({
      actorId: APIFY_ACTORS.CHEERIO_SCRAPER,
      input: {
        startUrls: urls.map((url) => ({ url })),
        maxRequestsPerCrawl: maxItems,
        pageFunction: `
          async function pageFunction(context) {
            const { $, request } = context;
            const posts = [];

            // Generic forum post extraction
            $('article, .post, .thread-content, .forum-post, .message-body').each((i, el) => {
              const text = $(el).text().trim();
              const author = $(el).find('.author, .username, .post-author').first().text().trim();
              if (text.length > 50) {
                posts.push({
                  url: request.url,
                  content: text.substring(0, 2000),
                  author,
                  source: request.url,
                });
              }
            });

            // Fallback: grab page title + main content
            if (posts.length === 0) {
              const title = $('h1, h2').first().text().trim();
              const content = $('main, .content, #content, article').first().text().trim();
              if (content.length > 100) {
                posts.push({ url: request.url, title, content: content.substring(0, 2000), source: request.url });
              }
            }

            return posts;
          }
        `,
        proxy: { useApifyProxy: true },
      },
      timeoutSecs: 180,
    });

    for (const item of items) {
      const post = parseForumItem(item, String((item as Record<string,unknown>).source ?? ""));
      if (post && !seen.has(post.externalId)) {
        seen.add(post.externalId);
        results.push(post);
      }
    }
  } catch (err) {
    console.error("Failed to scrape industrial forums:", err);
  }

  return results;
}
