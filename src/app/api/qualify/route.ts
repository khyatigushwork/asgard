import { NextRequest, NextResponse } from "next/server";
import { processUnanalyzedPosts } from "@/lib/ai/processor";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = body.limit ?? 50;

    const result = await processUnanalyzedPosts(limit);
    return NextResponse.json({ status: "completed", ...result });
  } catch (err) {
    return NextResponse.json({ error: "Failed to run qualification" }, { status: 500 });
  }
}
