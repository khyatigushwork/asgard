import prisma from "./client";
import type { RawPostData, Platform } from "@/types";
import crypto from "crypto";

function hashContent(content: string): string {
  return crypto.createHash("md5").update(content.trim().toLowerCase()).digest("hex");
}

export async function saveRawPosts(
  posts: RawPostData[],
  crawlJobId?: string,
  sourceId?: string
): Promise<number> {
  let saved = 0;

  for (const post of posts) {
    const contentHash = hashContent(post.content);
    try {
      await prisma.rawPost.upsert({
        where: {
          platform_externalId: {
            platform: post.platform,
            externalId: post.externalId,
          },
        },
        update: {
          upvotes: post.upvotes ?? 0,
          comments: post.comments ?? 0,
          views: post.views ?? 0,
        },
        create: {
          externalId: post.externalId,
          platform: post.platform,
          url: post.url,
          title: post.title,
          content: post.content,
          author: post.author,
          authorUrl: post.authorUrl,
          subreddit: post.subreddit,
          upvotes: post.upvotes ?? 0,
          comments: post.comments ?? 0,
          views: post.views ?? 0,
          shares: post.shares ?? 0,
          postedAt: post.postedAt,
          rawData: (post.rawData ?? {}) as object,
          contentHash,
          crawlJobId: crawlJobId ?? null,
          sourceId: sourceId ?? null,
        },
      });
      saved++;
    } catch (err) {
      console.error(`Failed to save post ${post.externalId}:`, err);
    }
  }

  return saved;
}

export async function checkDuplicate(
  platform: Platform,
  externalId: string,
  contentHash: string
): Promise<boolean> {
  const existing = await prisma.rawPost.findFirst({
    where: {
      OR: [
        { platform, externalId },
        { contentHash, platform },
      ],
    },
    select: { id: true },
  });
  return !!existing;
}

export async function getUnprocessedPosts(limit = 50) {
  return prisma.rawPost.findMany({
    where: { isProcessed: false, isDuplicate: false },
    orderBy: { fetchedAt: "desc" },
    take: limit,
  });
}

export async function markPostProcessed(id: string) {
  return prisma.rawPost.update({
    where: { id },
    data: { isProcessed: true },
  });
}

export async function getRawFeed(
  page = 1,
  pageSize = 20,
  platform?: Platform
) {
  const where = platform ? { platform } : {};
  const [data, total] = await Promise.all([
    prisma.rawPost.findMany({
      where,
      orderBy: { fetchedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { aiAnalysis: { select: { buyerIntentScore: true, delfinFitScore: true, isQualifiedLead: true } } },
    }),
    prisma.rawPost.count({ where }),
  ]);
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
