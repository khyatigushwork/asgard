/**
 * Background worker for scheduled crawling and AI qualification.
 * Run with: npm run worker
 */
import cron from "node-cron";
import { runCrawl } from "@/lib/apify/orchestrator";
import { processUnanalyzedPosts } from "@/lib/ai/processor";
import prisma from "@/lib/db/client";
import type { Platform } from "@/types";

const CRAWL_SCHEDULE = process.env.CRAWL_SCHEDULE ?? "0 */6 * * *"; // Every 6 hours
const QUALIFY_SCHEDULE = process.env.QUALIFY_SCHEDULE ?? "*/30 * * * *"; // Every 30 min

console.log("🚀 Industrial Buyer Discovery Worker starting...");
console.log(`📅 Crawl schedule: ${CRAWL_SCHEDULE}`);
console.log(`🤖 Qualification schedule: ${QUALIFY_SCHEDULE}`);

async function performCrawl() {
  console.log(`[${new Date().toISOString()}] Starting scheduled crawl...`);

  const configs = await prisma.platformConfig.findMany({
    where: { isActive: true },
  });

  const platforms: Platform[] =
    configs.length > 0
      ? (configs.map((c) => c.platform) as Platform[])
      : ["REDDIT", "QUORA", "TWITTER", "INDUSTRY_FORUMS"];

  let source = await prisma.source.findFirst({ where: { name: "Default" } });
  if (!source) {
    source = await prisma.source.create({
      data: {
        name: "Default",
        platform: "REDDIT",
        apifyActorId: "trudax/reddit-scraper-lite",
      },
    });
  }

  const job = await prisma.crawlJob.create({
    data: {
      sourceId: source.id,
      status: "RUNNING",
      startedAt: new Date(),
      config: { platforms, scheduled: true } as object,
    },
  });

  try {
    const results = await runCrawl({
      platforms,
      maxPerPlatform: 30,
      crawlJobId: job.id,
      sourceId: source.id,
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

    console.log(
      `[${new Date().toISOString()}] Crawl complete. Fetched: ${totalFetched}, Saved: ${totalSaved}`
    );
    results.forEach((r) => {
      console.log(
        `  ${r.platform}: ${r.fetched} fetched, ${r.saved} saved, ${r.duplicates} duplicates`
      );
      if (r.errors.length > 0) console.warn(`  Errors:`, r.errors);
    });
  } catch (err) {
    console.error("Crawl failed:", err);
    await prisma.crawlJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

async function performQualification() {
  console.log(`[${new Date().toISOString()}] Starting AI qualification...`);

  try {
    const result = await processUnanalyzedPosts(50, (done, total) => {
      process.stdout.write(`\r  Progress: ${done}/${total}`);
    });
    console.log(
      `\n[${new Date().toISOString()}] Qualification complete. Processed: ${result.processed}, Qualified: ${result.qualified}, Errors: ${result.errors}`
    );
  } catch (err) {
    console.error("Qualification failed:", err);
  }
}

// Schedule crawling
cron.schedule(CRAWL_SCHEDULE, performCrawl, { timezone: "UTC" });

// Schedule qualification (more frequent to keep up with new posts)
cron.schedule(QUALIFY_SCHEDULE, performQualification, { timezone: "UTC" });

// Run immediately on start if env flag set
if (process.env.RUN_ON_START === "true") {
  console.log("Running initial crawl and qualification...");
  performCrawl().then(() => performQualification());
}

console.log("✅ Worker ready. Waiting for scheduled tasks...");

// Keep alive
process.on("SIGTERM", async () => {
  console.log("Worker shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});
