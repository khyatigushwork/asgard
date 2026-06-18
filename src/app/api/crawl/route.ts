import { NextRequest, NextResponse } from "next/server";
import { runCrawl } from "@/lib/apify/orchestrator";
import { processUnanalyzedPosts } from "@/lib/ai/processor";
import prisma from "@/lib/db/client";
import type { Platform } from "@/types";

// Tell Vercel this is a long-running route (up to 300s on Pro, 60s on Hobby)
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const platforms = (body.platforms as Platform[]) ?? ["REDDIT", "TWITTER"];
    const maxPerPlatform = body.maxPerPlatform ?? 25;
    const runQualification = body.qualify !== false;

    const sourceId = await getOrCreateDefaultSource();
    const job = await prisma.crawlJob.create({
      data: {
        sourceId,
        status: "RUNNING",
        startedAt: new Date(),
        config: { platforms, maxPerPlatform } as object,
      },
    });

    try {
      // Run synchronously — Vercel serverless keeps the function alive until we respond
      const results = await runCrawl({
        platforms,
        maxPerPlatform,
        crawlJobId: job.id,
        sourceId,
      });

      const totalFetched = results.reduce((a, r) => a + r.fetched, 0);
      const totalSaved = results.reduce((a, r) => a + r.saved, 0);

      await prisma.crawlJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          postsFound: totalFetched,
          postsProcessed: totalSaved,
        },
      });

      let qualified = 0;
      if (runQualification && totalSaved > 0) {
        const result = await processUnanalyzedPosts(Math.min(totalSaved + 10, 50));
        qualified = result.qualified;
      }

      return NextResponse.json({
        jobId: job.id,
        status: "completed",
        fetched: totalFetched,
        saved: totalSaved,
        qualified,
        results,
      });
    } catch (err) {
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  } catch (err) {
    console.error("Crawl error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run crawl" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const jobs = await prisma.crawlJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(jobs);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch crawl history" }, { status: 500 });
  }
}

async function getOrCreateDefaultSource(): Promise<string> {
  let source = await prisma.source.findFirst({ where: { name: "Default" } });
  if (!source) {
    source = await prisma.source.create({
      data: {
        name: "Default",
        platform: "REDDIT",
        apifyActorId: "trudax/reddit-scraper-lite",
        description: "Default multi-platform source",
      },
    });
  }
  return source.id;
}
