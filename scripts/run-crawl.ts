/**
 * Direct crawl + qualify runner — no HTTP timeout constraints.
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/run-crawl.ts
 */
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [k, ...rest] = trimmed.split("=");
    const v = rest.join("=").replace(/^["']|["']$/g, "");
    if (k && !process.env[k]) process.env[k] = v;
  }
}

async function main() {
  const { runCrawl } = await import("../src/lib/nimble/orchestrator");
  const { processUnanalyzedPosts } = await import("../src/lib/ai/processor");
  const prisma = (await import("../src/lib/db/client")).default;

  // Create a crawl job record
  let source = await prisma.source.findFirst({ where: { name: "Default" } });
  if (!source) {
    source = await prisma.source.create({
      data: { name: "Default", platform: "REDDIT", apifyActorId: "nimble/reddit", description: "Default source" },
    });
  }
  const job = await prisma.crawlJob.create({
    data: { sourceId: source.id, status: "RUNNING", startedAt: new Date(), config: {} },
  });

  console.log("\n=== STAGE 1: Crawling Reddit via Nimble ===");
  const platforms: Array<"REDDIT" | "LINKEDIN"> = ["LINKEDIN"];
  const results = await runCrawl({ platforms, maxPerPlatform: 100, crawlJobId: job.id, sourceId: source.id });

  const fetched = results.reduce((a, r) => a + r.fetched, 0);
  const saved   = results.reduce((a, r) => a + r.saved, 0);
  const dupes   = results.reduce((a, r) => a + r.duplicates, 0);
  console.log(`\nFetched: ${fetched} | New posts saved: ${saved} | Duplicates: ${dupes}`);
  if (results[0]?.errors.length) console.log("Errors:", results[0].errors);

  await prisma.crawlJob.update({
    where: { id: job.id },
    data: { status: "COMPLETED", completedAt: new Date(), postsFound: fetched, postsProcessed: saved },
  });

  console.log("\n=== STAGE 2: AI Qualification ===");
  const pending = await prisma.rawPost.count({ where: { isProcessed: false } });
  console.log(`${pending} posts pending analysis...`);

  let totalProcessed = 0, totalQualified = 0;
  while (true) {
    const batch = await processUnanalyzedPosts(20);
    totalProcessed += batch.processed;
    totalQualified += batch.qualified;
    console.log(`  Batch: ${batch.processed} processed, ${batch.qualified} qualified (total: ${totalProcessed} / ${totalQualified})`);
    if (batch.processed === 0) break;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total qualified leads: ${totalQualified}`);

  const final = await prisma.lead.findMany({
    where: { isQualified: true },
    orderBy: { buyerIntentScore: "desc" },
    take: 20,
    select: { buyerIntentScore: true, industry: true, problemStatement: true, urgency: true, url: true, author: true },
  });

  console.log("\n=== TOP QUALIFIED LEADS ===");
  for (const lead of final) {
    console.log(`\n[${lead.buyerIntentScore}/100] ${lead.industry ?? "Unknown industry"}`);
    console.log(`  Author:  ${lead.author}`);
    console.log(`  Problem: ${lead.problemStatement}`);
    console.log(`  Urgency: ${lead.urgency}`);
    console.log(`  URL:     ${lead.url}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
