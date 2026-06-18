import { NextRequest, NextResponse } from "next/server";
import { runCrawl } from "@/lib/apify/orchestrator";
import { processUnanalyzedPosts } from "@/lib/ai/processor";
import prisma from "@/lib/db/client";
import type { Platform } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const platforms = (body.platforms as Platform[]) ?? ["REDDIT", "QUORA", "TWITTER", "INDUSTRY_FORUMS"];
    const maxPerPlatform = body.maxPerPlatform ?? 30;
    const runQualification = body.qualify !== false;

    // Create a crawl job record
    const job = await prisma.crawlJob.create({
      data: {
        sourceId: await getOrCreateDefaultSource(),
        status: "RUNNING",
        startedAt: new Date(),
        config: { platforms, maxPerPlatform } as object,
      },
    });

    // Run async - respond immediately
    const jobId = job.id;

    // Fire and forget
    (async () => {
      try {
        const results = await runCrawl({
          platforms,
          maxPerPlatform,
          crawlJobId: jobId,
        });

        const totalFetched = results.reduce((a, r) => a + r.fetched, 0);
        const totalSaved = results.reduce((a, r) => a + r.saved, 0);

        await prisma.crawlJob.update({
          where: { id: jobId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            postsFound: totalFetched,
            postsProcessed: totalSaved,
          },
        });

        if (runQualification && totalSaved > 0) {
          await processUnanalyzedPosts(totalSaved + 10);
        }
      } catch (err) {
        await prisma.crawlJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    })();

    return NextResponse.json({ jobId, status: "started" });
  } catch (err) {
    return NextResponse.json({ error: "Failed to start crawl" }, { status: 500 });
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
  let source = await prisma.source.findFirst({
    where: { name: "Default" },
  });
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
