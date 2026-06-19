/**
 * LinkedIn-specific crawl + qualify runner using known OutX watchlist IDs.
 */
import * as fs from "fs";
import * as path from "path";

// Load .env
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...rest] = t.split("=");
    const v = rest.join("=").replace(/^["']|["']$/g, "");
    if (k && !process.env[k]) process.env[k] = v;
  }
}

// Both known watchlist IDs from the OutX free plan
const WATCHLIST_IDS = [
  "8ba4f758-c305-4724-a9c8-83019e29771c", // IBD_Test
  "9f15a571-7111-4b59-abb9-3fa749de613e", // IBD_Sourcing_Procurement
];

function dateNDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
}

async function main() {
  const { fetchWatchlistPosts } = await import("../src/lib/outx/client");
  const { saveRawPosts, checkDuplicate } = await import("../src/lib/db/posts");
  const { processUnanalyzedPosts } = await import("../src/lib/ai/processor");
  const prisma = (await import("../src/lib/db/client")).default;
  const crypto = await import("crypto");

  function hashContent(s: string) {
    return crypto.createHash("md5").update(s.trim().toLowerCase()).digest("hex");
  }

  console.log("\n=== STAGE 1: Fetching LinkedIn posts from OutX ===");

  let source = await prisma.source.findFirst({ where: { name: "LinkedIn-OutX" } });
  if (!source) {
    source = await prisma.source.create({
      data: { name: "LinkedIn-OutX", platform: "LINKEDIN", apifyActorId: "outx/linkedin", description: "LinkedIn via OutX API" },
    });
  }
  const job = await prisma.crawlJob.create({
    data: { sourceId: source.id, status: "RUNNING", startedAt: new Date(), config: {} },
  });

  let totalFetched = 0, totalSaved = 0, totalDupes = 0;

  for (const watchlistId of WATCHLIST_IDS) {
    // Fetch without date filter first to get all available posts
    const posts = await fetchWatchlistPosts({
      watchlist_id: watchlistId,
      sort_by: "recent",
      page_size: 100,
    });

    console.log(`[OutX] Watchlist ${watchlistId}: ${posts.length} posts`);
    totalFetched += posts.length;

    for (const post of posts) {
      const id = post.id ?? post.urn ?? post.linkedin_post_url;
      if (!id) continue;

      const content = post.content ?? post.text ?? "";
      if (content.length < 30) continue;

      const contentHash = hashContent(content);
      const isDupe = await checkDuplicate("LINKEDIN", id, contentHash);
      if (isDupe) { totalDupes++; continue; }

      const postUrl =
        post.url ||
        (post.linkedin_post_url
          ? `https://www.linkedin.com/feed/update/${post.linkedin_post_url}`
          : "");

      const postedAt = post.post_date ?? post.posted_at ?? post.created_at;
      const authorName = (post as Record<string, unknown>)["author_name"] as string
        ?? post.author?.name ?? "unknown";
      const authorUrl = (post as Record<string, unknown>)["author_linkedin_url"] as string
        ?? post.author?.profile_url;

      await saveRawPosts([{
        externalId: id,
        platform: "LINKEDIN",
        url: postUrl || `https://linkedin.com`,
        content,
        author: authorName,
        authorUrl,
        upvotes: post.likes ?? post.num_likes ?? 0,
        comments: post.comments ?? post.num_comments ?? 0,
        postedAt: postedAt ? new Date(postedAt) : undefined,
        rawData: {
          ...(post as unknown as Record<string, unknown>),
          content_hash: contentHash,
          watchlist_id: watchlistId,
        },
      }], job.id, source.id);
      totalSaved++;
    }
  }

  await prisma.crawlJob.update({
    where: { id: job.id },
    data: { status: "COMPLETED", completedAt: new Date(), postsFound: totalFetched, postsProcessed: totalSaved },
  });

  console.log(`\nFetched: ${totalFetched} | Saved: ${totalSaved} | Dupes: ${totalDupes}`);

  console.log("\n=== STAGE 2: AI Qualification ===");
  let totalProcessed = 0, totalQualified = 0;
  while (true) {
    const batch = await processUnanalyzedPosts(15);
    totalProcessed += batch.processed;
    totalQualified += batch.qualified;
    process.stdout.write(`  Processed ${totalProcessed}, qualified ${totalQualified}\r`);
    if (batch.processed === 0) break;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n\n=== TOP QUALIFIED LINKEDIN LEADS ===`);
  const leads = await prisma.lead.findMany({
    where: { isQualified: true, platform: "LINKEDIN" },
    orderBy: { buyerIntentScore: "desc" },
    select: {
      buyerIntentScore: true, delfinFitScore: true, confidenceScore: true,
      industry: true, likelyRole: true, companyType: true,
      problemStatement: true, requiredSolution: true,
      urgency: true, projectSize: true, url: true, author: true,
      aiAnalysis: { select: { reasoning: true } },
    },
  });

  console.log(`Total qualified leads from LinkedIn: ${leads.length}\n`);
  for (const lead of leads) {
    console.log(`[${ lead.buyerIntentScore}/100 intent | ${lead.delfinFitScore}/100 fit] ${lead.industry ?? "Unknown"}`);
    console.log(`  Role:     ${lead.likelyRole ?? "?"} @ ${lead.companyType ?? "?"}`);
    console.log(`  Problem:  ${lead.problemStatement}`);
    console.log(`  Solution: ${lead.requiredSolution}`);
    console.log(`  Urgency:  ${lead.urgency} | Size: ${lead.projectSize}`);
    console.log(`  Author:   ${lead.author}`);
    console.log(`  URL:      ${lead.url}`);
    console.log(`  Reason:   ${lead.aiAnalysis?.reasoning}`);
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
