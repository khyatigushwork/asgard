import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/db/leads";
import prisma from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [analytics, crawlStats, processingStats] = await Promise.all([
      getAnalytics(),
      prisma.crawlJob.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.rawPost.aggregate({
        _count: { id: true },
        where: { isProcessed: false },
      }),
    ]);

    return NextResponse.json({
      ...analytics,
      crawlStats: Object.fromEntries(
        crawlStats.map((s) => [s.status, s._count.status])
      ),
      pendingProcessing: processingStats._count.id,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
