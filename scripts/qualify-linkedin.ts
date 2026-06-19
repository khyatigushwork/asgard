/**
 * Qualify only unprocessed LinkedIn posts.
 */
import * as fs from "fs";
import * as path from "path";

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

async function main() {
  const { analyzePost } = await import("../src/lib/ai/qualification-agent");
  const prisma = (await import("../src/lib/db/client")).default;

  const pending = await prisma.rawPost.findMany({
    where: { isProcessed: false, platform: "LINKEDIN" },
  });

  console.log(`LinkedIn posts to qualify: ${pending.length}`);

  let processed = 0, qualified = 0;

  for (const post of pending) {
    try {
      const t0 = Date.now();
      const result = await analyzePost({
        rawPostId: post.id,
        content: post.content,
        title: post.title ?? "",
        url: post.url,
        author: post.author ?? undefined,
        platform: post.platform as "LINKEDIN",
        upvotes: post.upvotes,
        comments: post.comments,
      });
      const elapsed = Date.now() - t0;

      if (!result) {
        await prisma.rawPost.update({ where: { id: post.id }, data: { isProcessed: true } });
        processed++;
        continue;
      }

      // Save AI analysis
      await prisma.aiAnalysis.upsert({
        where: { rawPostId: post.id },
        create: {
          rawPostId: post.id,
          buyerIntentScore: result.buyer_intent_score,
          delfinFitScore: result.delfin_fit_score,
          confidenceScore: result.confidence,
          isQualifiedLead: result.qualified_lead,
          industry: result.industry,
          companyType: result.company_type,
          likelyRole: result.likely_role,
          problemStatement: result.problem_statement,
          requiredSolution: result.required_solution,
          productCategory: result.product_category,
          machineCategory: result.machine_category,
          serviceCategory: result.service_category,
          urgency: result.urgency,
          projectSize: result.project_size,
          customizationLevel: result.customization_level,
          customSolutionNeeded: result.custom_solution_needed,
          b2bRelevance: result.score_breakdown?.b2b_relevance,
          manufacturingReq: result.score_breakdown?.manufacturing_requirement,
          engineeringReq: result.score_breakdown?.engineering_requirement,
          industrialRelevance: result.score_breakdown?.industrial_relevance,
          reasoning: result.reasoning,
          rawResponse: result as object,
          modelUsed: "claude-sonnet-4-6",
          processingTimeMs: elapsed,
        },
        update: {
          buyerIntentScore: result.buyer_intent_score,
          isQualifiedLead: result.qualified_lead,
          reasoning: result.reasoning,
        },
      });

      // Save lead if qualified
      if (result.qualified_lead) {
        qualified++;
        await prisma.lead.upsert({
          where: { rawPostId: post.id },
          create: {
            rawPostId: post.id,
            platform: "LINKEDIN",
            url: post.url,
            author: post.author,
            isQualified: true,
            buyerIntentScore: result.buyer_intent_score,
            delfinFitScore: result.delfin_fit_score,
            confidenceScore: result.confidence,
            industry: result.industry,
            likelyRole: result.likely_role,
            companyType: result.company_type,
            problemStatement: result.problem_statement,
            requiredSolution: result.required_solution,
            urgency: (result.urgency ?? "UNKNOWN") as "IMMEDIATE" | "SHORT_TERM" | "LONG_TERM" | "UNKNOWN",
            projectSize: (result.project_size ?? "UNKNOWN") as "SMALL" | "MEDIUM" | "LARGE" | "UNKNOWN",
          },
          update: {
            isQualified: true,
            buyerIntentScore: result.buyer_intent_score,
          },
        });
      } else {
        await prisma.lead.upsert({
          where: { rawPostId: post.id },
          create: {
            rawPostId: post.id,
            platform: "LINKEDIN",
            url: post.url,
            author: post.author,
            isQualified: false,
            buyerIntentScore: result.buyer_intent_score,
            delfinFitScore: result.delfin_fit_score,
            confidenceScore: result.confidence,
            industry: result.industry,
            likelyRole: result.likely_role,
            companyType: result.company_type,
            problemStatement: result.problem_statement,
            requiredSolution: result.required_solution,
            urgency: (result.urgency ?? "UNKNOWN") as "IMMEDIATE" | "SHORT_TERM" | "LONG_TERM" | "UNKNOWN",
            projectSize: (result.project_size ?? "UNKNOWN") as "SMALL" | "MEDIUM" | "LARGE" | "UNKNOWN",
          },
          update: { isQualified: false, buyerIntentScore: result.buyer_intent_score },
        });
      }

      await prisma.rawPost.update({ where: { id: post.id }, data: { isProcessed: true } });
      processed++;
      process.stdout.write(`\r  Processed ${processed}/${pending.length}, qualified ${qualified}`);
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`\nError on post ${post.id}:`, (err as Error).message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n\n=== QUALIFIED LINKEDIN LEADS ===`);
  const leads = await prisma.lead.findMany({
    where: { isQualified: true, platform: "LINKEDIN" },
    orderBy: { buyerIntentScore: "desc" },
    include: { aiAnalysis: { select: { reasoning: true } } },
  });

  console.log(`Total qualified: ${leads.length}\n`);
  for (const lead of leads) {
    console.log(`[${lead.buyerIntentScore}/100] ${lead.industry ?? "Unknown"}`);
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
