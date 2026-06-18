import { NextRequest, NextResponse } from "next/server";
import { processUnanalyzedPosts } from "@/lib/ai/processor";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = body.limit ?? 50;

    // Process in background
    processUnanalyzedPosts(limit).catch(console.error);

    return NextResponse.json({ status: "started", limit });
  } catch (err) {
    return NextResponse.json({ error: "Failed to start qualification" }, { status: 500 });
  }
}
