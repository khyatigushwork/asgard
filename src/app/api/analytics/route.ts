import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/db/leads";
import prisma from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [analytics, crawlStats, rawPostStats, rawByPlatform, recentRawPosts] = await Promise.all([
      getAnalytics(),
      prisma.crawlJob.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.rawPost.aggregate({
        _count: { id: true },
      }),
      prisma.rawPost.groupBy({
        by: ["platform"],
        _count: { platform: true },
      }),
      prisma.rawPost.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          platform: true,
          title: true,
          author: true,
          url: true,
          createdAt: true,
          isProcessed: true,
          upvotes: true,
        },
      }),
    ]);

    const pendingProcessing = await prisma.rawPost.count({ where: { isProcessed: false } });

    return NextResponse.json({
      ...analytics,
      crawlStats: Object.fromEntries(
        crawlStats.map((s) => [s.status, s._count.status])
      ),
      pendingProcessing,
      totalRawPosts: rawPostStats._count.id,
      rawByPlatform: Object.fromEntries(
        rawByPlatform.map((p) => [p.platform, p._count.platform])
      ),
      recentRawPosts,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
