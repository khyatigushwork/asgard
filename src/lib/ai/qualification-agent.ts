import Anthropic from "@anthropic-ai/sdk";
import type { AiAnalysisResult, Platform, Urgency, ProjectSize } from "@/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an industrial buyer discovery analyst. Your job is to find people who want to BUY industrial products, equipment, parts, or services — whether off-the-shelf, standard SKU, or custom. The buyer's intent to purchase is what matters, not whether the product is custom or standard.

## Your Core Mission

Flag anyone who is actively trying to acquire, procure, buy, or source ANY industrial product or service — even if the product is readily available. Your client sells industrial goods and wants to reach potential buyers early. If someone is looking to buy something industrial, that is a lead.

## Score HIGH (buyer_intent_score 70-100) for:
- Anyone asking where to buy, find, or source industrial equipment or parts
- Anyone asking for pricing, quotes, or supplier recommendations
- Anyone describing a purchasing decision they are working through
- Anyone comparing products/suppliers before buying
- Anyone who has a broken machine or missing part and needs a replacement
- Anyone expanding operations and needs new equipment
- Anyone asking about distributors, vendors, or local suppliers
- RFQ or procurement language
- Businesses setting up new production lines or facilities
- Anyone mentioning budget or timeline for a purchase

## Score MEDIUM (buyer_intent_score 40-69) for:
- Someone who might buy in the near future but hasn't decided yet
- Someone researching options (could convert to buyer)
- Someone with an operational problem that will require a purchase

## Score LOW (buyer_intent_score 0-39) for:
- Pure hobbyists with no business context
- Students doing academic work
- People just discussing or debating (no purchase intent)
- News or general industry discussion
- People selling, not buying
- Purely theoretical questions

## Key Rule
Do NOT penalise someone for wanting a standard/off-the-shelf product. A person asking "where can I buy a hydraulic pump" is just as valid a lead as someone needing a custom-built system. Both are buyers.

## Output Format

Always respond with a single valid JSON object. No markdown, no explanation outside JSON.`;

const USER_PROMPT_TEMPLATE = (
  platform: string,
  content: string,
  title?: string,
  author?: string,
  subreddit?: string,
  engagementMetrics?: string
) => `Analyze this ${platform} post for industrial procurement signals.

${title ? `TITLE: ${title}\n` : ""}${subreddit ? `COMMUNITY: r/${subreddit}\n` : ""}${author ? `AUTHOR: ${author}\n` : ""}${engagementMetrics ? `ENGAGEMENT: ${engagementMetrics}\n` : ""}
CONTENT:
${content.substring(0, 3000)}

Respond ONLY with a JSON object in exactly this format:
{
  "buyer_intent_score": <0-100 integer>,
  "delfin_fit_score": <0-100 integer>,
  "confidence": <0-100 integer>,
  "industry": "<specific industry or null>",
  "company_type": "<type of company or null>",
  "likely_role": "<person's likely job role or null>",
  "problem_statement": "<clear 1-2 sentence description of their problem or null>",
  "required_solution": "<what they actually need or null>",
  "product_category": "<industrial product category or null>",
  "machine_category": "<specific machine type if applicable or null>",
  "service_category": "<service type if applicable or null>",
  "project_size": "<SMALL|MEDIUM|LARGE|ENTERPRISE|UNKNOWN>",
  "urgency": "<IMMEDIATE|SHORT_TERM|MEDIUM_TERM|LONG_TERM|UNKNOWN>",
  "customization_level": "<standard|semi-custom|fully-custom|unknown>",
  "custom_solution_needed": <true|false>,
  "qualified_lead": <true if buyer_intent_score >= 60 else false>,
  "score_breakdown": {
    "b2b_relevance": <0-100>,
    "customization_requirement": <0-100>,
    "manufacturing_requirement": <0-100>,
    "engineering_requirement": <0-100>,
    "industrial_relevance": <0-100>,
    "supplier_discovery_need": <0-100>,
    "potential_project_value": <0-100>
  },
  "reasoning": "<2-3 sentence explanation of your scoring and why this is or isn't a qualified lead>"
}

SCORING GUIDELINES:
- buyer_intent_score 90-100: Actively buying right now — asking for price, supplier, where to buy, RFQ
- buyer_intent_score 70-89: Clear purchase intent — evaluating options, comparing suppliers, has a specific need
- buyer_intent_score 40-69: Potential buyer — has a problem that will likely require a purchase
- buyer_intent_score 20-39: Weak signal — tangentially related, no clear purchase decision
- buyer_intent_score 0-19: No buyer intent — hobbyist, student, news, pure discussion

IMPORTANT: Score buyer_intent_score based ONLY on likelihood they will BUY something industrial.
Standard off-the-shelf products count. Local availability does not lower the score.
A person asking "where to buy a conveyor belt" scores 90+.

- delfin_fit_score: How relevant is this person's need to industrial products/equipment/parts/services in general? Score high for any industrial sector purchase.
- confidence: How certain are you about the person's intent given the post content?`;

export interface PostToAnalyze {
  rawPostId: string;
  platform: Platform;
  content: string;
  title?: string;
  author?: string;
  subreddit?: string;
  upvotes?: number;
  comments?: number;
  url: string;
}

export async function analyzePost(
  post: PostToAnalyze
): Promise<AiAnalysisResult | null> {
  const engagementMetrics =
    post.upvotes !== undefined
      ? `${post.upvotes} upvotes, ${post.comments ?? 0} comments`
      : undefined;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: USER_PROMPT_TEMPLATE(
            post.platform,
            post.content,
            post.title,
            post.author,
            post.subreddit,
            engagementMetrics
          ),
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") return null;

    const raw = textContent.text.trim();
    // Extract JSON from response (handle any wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in AI response:", raw.substring(0, 200));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      lead_id: post.rawPostId,
      platform: post.platform,
      url: post.url,
      author: post.author,
      buyer_intent_score: Number(parsed.buyer_intent_score) || 0,
      delfin_fit_score: Number(parsed.delfin_fit_score) || 0,
      confidence: Number(parsed.confidence) || 0,
      industry: parsed.industry || null,
      company_type: parsed.company_type || null,
      likely_role: parsed.likely_role || null,
      problem_statement: parsed.problem_statement || null,
      required_solution: parsed.required_solution || null,
      product_category: parsed.product_category || null,
      machine_category: parsed.machine_category || null,
      service_category: parsed.service_category || null,
      project_size: (parsed.project_size as ProjectSize) || "UNKNOWN",
      urgency: (parsed.urgency as Urgency) || "UNKNOWN",
      customization_level: parsed.customization_level || null,
      custom_solution_needed: Boolean(parsed.custom_solution_needed),
      qualified_lead: Number(parsed.buyer_intent_score) >= 60,
      reasoning: parsed.reasoning || "",
      score_breakdown: parsed.score_breakdown || {
        b2b_relevance: 0,
        customization_requirement: 0,
        manufacturing_requirement: 0,
        engineering_requirement: 0,
        industrial_relevance: 0,
        supplier_discovery_need: 0,
        potential_project_value: 0,
      },
    };
  } catch (err) {
    console.error(`Failed to analyze post ${post.rawPostId}:`, err);
    return null;
  }
}

export async function analyzeBatch(
  posts: PostToAnalyze[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, AiAnalysisResult>> {
  const results = new Map<string, AiAnalysisResult>();
  const CONCURRENCY = 3;

  for (let i = 0; i < posts.length; i += CONCURRENCY) {
    const batch = posts.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((post) => analyzePost(post))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled" && result.value) {
        results.set(batch[j].rawPostId, result.value);
      }
    }

    onProgress?.(Math.min(i + CONCURRENCY, posts.length), posts.length);

    // Rate limiting: small delay between batches
    if (i + CONCURRENCY < posts.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}
