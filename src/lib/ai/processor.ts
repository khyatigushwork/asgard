import prisma from "../db/client";
import { analyzePost, analyzeBatch, type PostToAnalyze } from "./qualification-agent";
import { getUnprocessedPosts, markPostProcessed } from "../db/posts";
import type { AiAnalysisResult } from "@/types";

async function saveAnalysis(result: AiAnalysisResult, rawPostId: string, processingTimeMs: number) {
  // Upsert AI analysis
  const analysis = await prisma.aiAnalysis.upsert({
    where: { rawPostId },
    update: {
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
      b2bRelevance: result.score_breakdown.b2b_relevance,
      manufacturingReq: result.score_breakdown.manufacturing_requirement,
      engineeringReq: result.score_breakdown.engineering_requirement,
      industrialRelevance: result.score_breakdown.industrial_relevance,
      reasoning: result.reasoning,
      rawResponse: result as object,
      modelUsed: "claude-sonnet-4-6",
      processingTimeMs,
    },
    create: {
      rawPostId,
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
      b2bRelevance: result.score_breakdown.b2b_relevance,
      manufacturingReq: result.score_breakdown.manufacturing_requirement,
      engineeringReq: result.score_breakdown.engineering_requirement,
      industrialRelevance: result.score_breakdown.industrial_relevance,
      reasoning: result.reasoning,
      rawResponse: result as object,
      modelUsed: "claude-sonnet-4-6",
      processingTimeMs,
    },
  });

  // If qualified, upsert lead record
  if (result.qualified_lead) {
    const rawPost = await prisma.rawPost.findUnique({
      where: { id: rawPostId },
      select: { platform: true, url: true, author: true, title: true },
    });

    if (rawPost) {
      await prisma.lead.upsert({
        where: { rawPostId },
        update: {
          buyerIntentScore: result.buyer_intent_score,
          delfinFitScore: result.delfin_fit_score,
          confidenceScore: result.confidence,
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
          isQualified: true,
        },
        create: {
          rawPostId,
          aiAnalysisId: analysis.id,
          platform: rawPost.platform,
          url: rawPost.url,
          author: rawPost.author,
          title: rawPost.title,
          buyerIntentScore: result.buyer_intent_score,
          delfinFitScore: result.delfin_fit_score,
          confidenceScore: result.confidence,
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
          isQualified: true,
        },
      });
    }
  }

  await markPostProcessed(rawPostId);
  return analysis;
}

export async function processUnanalyzedPosts(
  limit = 50,
  onProgress?: (done: number, total: number) => void
): Promise<{ processed: number; qualified: number; errors: number }> {
  const posts = await getUnprocessedPosts(limit);

  if (posts.length === 0) {
    return { processed: 0, qualified: 0, errors: 0 };
  }

  const postInputs: PostToAnalyze[] = posts.map((p) => ({
    rawPostId: p.id,
    platform: p.platform as import("@/types").Platform,
    content: p.content,
    title: p.title ?? undefined,
    author: p.author ?? undefined,
    subreddit: p.subreddit ?? undefined,
    upvotes: p.upvotes,
    comments: p.comments,
    url: p.url,
  }));

  let processed = 0;
  let qualified = 0;
  let errors = 0;

  for (const postInput of postInputs) {
    try {
      const start = Date.now();
      const result = await analyzePost(postInput);
      const processingTimeMs = Date.now() - start;

      if (result) {
        await saveAnalysis(result, postInput.rawPostId, processingTimeMs);
        if (result.qualified_lead) qualified++;
        processed++;
      } else {
        await markPostProcessed(postInput.rawPostId);
        errors++;
      }
    } catch (err) {
      console.error(`Failed to process post ${postInput.rawPostId}:`, err);
      errors++;
    }

    onProgress?.(processed + errors, posts.length);
    // Small delay to avoid API rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  return { processed, qualified, errors };
}
