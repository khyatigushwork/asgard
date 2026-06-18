import Anthropic from "@anthropic-ai/sdk";
import type { AiAnalysisResult, Platform, Urgency, ProjectSize } from "@/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an expert industrial procurement intelligence analyst working for Delfin, a company that sells custom industrial products, machinery, manufacturing services, fabrication services, automation solutions, engineering services, OEM components, and industrial equipment to B2B buyers.

Your job is to analyze social media posts, forum discussions, and online conversations to identify genuine industrial procurement opportunities.

## Your Core Mission

Identify posts from real business decision-makers who have genuine operational problems that require external suppliers, custom manufacturing, engineering expertise, or industrial equipment.

## What You Are Looking For

STRONG SIGNALS:
- Companies actively sourcing suppliers or manufacturers
- Production managers facing equipment or capacity challenges
- Engineers needing custom fabricated parts or assemblies
- Operations teams looking for automation solutions
- Procurement officers requesting quotes or vendor recommendations
- Business owners expanding manufacturing capacity
- Companies describing specific technical requirements for industrial products
- RFQ (Request for Quote) language or procurement intent
- Descriptions of failed suppliers or supply chain problems

WEAK OR NEGATIVE SIGNALS (score low):
- Students asking theoretical questions
- Hobbyists making things at home
- Academic researchers
- News articles being discussed
- Product reviews or consumer purchases
- General curiosity questions
- Memes or entertainment
- Political discussions
- Employees looking for jobs
- People selling (not buying) products

## Delfin Fit Factors

Score Delfin Fit based on these specific capabilities:
1. Custom manufacturing or fabrication needs
2. Industrial machinery or equipment
3. Automation and control systems (PLC, robotics, SCADA)
4. Precision machining (CNC, turning, milling)
5. Metal fabrication (welding, sheet metal, structural)
6. Injection molding or plastic components
7. Engineering design services
8. OEM component supply
9. Production line or assembly equipment
10. Industrial process equipment

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
  "qualified_lead": <true if buyer_intent_score >= 70 AND delfin_fit_score >= 70 else false>,
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
- buyer_intent_score 90-100: Active RFQ, explicit supplier search, urgent procurement need
- buyer_intent_score 75-89: Strong signals, discussing specific procurement challenges
- buyer_intent_score 50-74: Potential future buyer, awareness stage
- buyer_intent_score 25-49: Weak signal, tangentially related
- buyer_intent_score 0-24: No commercial intent (student, hobbyist, news, etc.)
- delfin_fit_score: How well does this match Delfin's B2B industrial manufacturing/automation capabilities?
- confidence: How certain are you about your analysis given the information available?`;

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
      qualified_lead:
        Number(parsed.buyer_intent_score) >= 70 &&
        Number(parsed.delfin_fit_score) >= 70,
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
