import prisma, { type Prisma } from "./client";
import type { LeadFilters, PaginatedResult } from "@/types";

export async function getLeads(
  filters: LeadFilters = {},
  onlyQualified = false
): Promise<PaginatedResult<Record<string, unknown>>> {
  const {
    platform,
    industry,
    minBuyerIntent,
    maxBuyerIntent,
    minDelfinFit,
    maxDelfinFit,
    urgency,
    projectSize,
    customSolutionNeeded,
    dateFrom,
    dateTo,
    search,
    page = 1,
    pageSize = 20,
    sortBy = "buyerIntentScore",
    sortOrder = "desc",
  } = filters;

  const where: Record<string, unknown> = {
    isArchived: false,
  };

  if (onlyQualified) where.isQualified = true;
  if (filters.isQualified !== undefined) where.isQualified = filters.isQualified;
  if (platform) where.platform = platform;
  if (industry) where.industry = { contains: industry, mode: "insensitive" };
  if (urgency) where.urgency = urgency;
  if (projectSize) where.projectSize = projectSize;
  if (customSolutionNeeded !== undefined) where.customSolutionNeeded = customSolutionNeeded;

  if (minBuyerIntent !== undefined || maxBuyerIntent !== undefined) {
    where.buyerIntentScore = {
      ...(minBuyerIntent !== undefined ? { gte: minBuyerIntent } : {}),
      ...(maxBuyerIntent !== undefined ? { lte: maxBuyerIntent } : {}),
    };
  }

  if (minDelfinFit !== undefined || maxDelfinFit !== undefined) {
    where.delfinFitScore = {
      ...(minDelfinFit !== undefined ? { gte: minDelfinFit } : {}),
      ...(maxDelfinFit !== undefined ? { lte: maxDelfinFit } : {}),
    };
  }

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  if (search) {
    where.OR = [
      { problemStatement: { contains: search, mode: "insensitive" } },
      { requiredSolution: { contains: search, mode: "insensitive" } },
      { industry: { contains: search, mode: "insensitive" } },
      { author: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
    ];
  }

  const validSortFields = [
    "buyerIntentScore",
    "delfinFitScore",
    "confidenceScore",
    "createdAt",
    "urgency",
  ];
  const primarySort = validSortFields.includes(sortBy)
    ? { [sortBy]: sortOrder }
    : { buyerIntentScore: "desc" as const };
  // contacted leads always sink to the bottom
  const orderBy = [{ contacted: "asc" as const }, primarySort];

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where: where as Prisma.LeadWhereInput,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        rawPost: {
          select: {
            content: true,
            postedAt: true,
            upvotes: true,
            comments: true,
          },
        },
        aiAnalysis: {
          select: {
            reasoning: true,
            b2bRelevance: true,
            manufacturingReq: true,
            engineeringReq: true,
            industrialRelevance: true,
            rawResponse: true,
          },
        },
      },
    }),
    prisma.lead.count({
      where: where as Prisma.LeadWhereInput,
    }),
  ]);

  return {
    data: data as unknown as Record<string, unknown>[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getLeadById(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      rawPost: true,
      aiAnalysis: true,
    },
  });
}

export async function getAnalytics() {
  const [
    totalLeads,
    qualifiedLeads,
    avgScores,
    byPlatform,
    byIndustry,
    byUrgency,
    recentTrend,
  ] = await Promise.all([
    prisma.lead.count({ where: { isArchived: false } }),
    prisma.lead.count({ where: { isQualified: true, isArchived: false } }),
    prisma.lead.aggregate({
      _avg: { buyerIntentScore: true, delfinFitScore: true },
    }),
    prisma.lead.groupBy({
      by: ["platform"],
      _count: { platform: true },
      where: { isArchived: false },
    }),
    prisma.lead.groupBy({
      by: ["industry"],
      _count: { industry: true },
      where: { isArchived: false, industry: { not: null } },
      orderBy: { _count: { industry: "desc" } },
      take: 10,
    }),
    prisma.lead.groupBy({
      by: ["urgency"],
      _count: { urgency: true },
      where: { isArchived: false },
    }),
    // Last 14 days trend
    prisma.$queryRaw<Array<{ date: string; count: bigint; qualified: bigint }>>`
      SELECT
        DATE_TRUNC('day', "createdAt")::date::text as date,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE "isQualified" = true) as qualified
      FROM leads
      WHERE "createdAt" >= NOW() - INTERVAL '14 days'
      AND "isArchived" = false
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `,
  ]);

  return {
    totalLeads,
    qualifiedLeads,
    avgBuyerIntent: Math.round(avgScores._avg.buyerIntentScore ?? 0),
    avgDelfinFit: Math.round(avgScores._avg.delfinFitScore ?? 0),
    byPlatform: Object.fromEntries(
      byPlatform.map((p) => [p.platform, p._count.platform])
    ),
    byIndustry: Object.fromEntries(
      byIndustry.map((p) => [p.industry ?? "Unknown", p._count.industry])
    ),
    byUrgency: Object.fromEntries(
      byUrgency.map((p) => [p.urgency, p._count.urgency])
    ),
    recentTrend: recentTrend.map((r) => ({
      date: r.date,
      count: Number(r.count),
      qualified: Number(r.qualified),
    })),
  };
}

export async function archiveLead(id: string) {
  return prisma.lead.update({ where: { id }, data: { isArchived: true } });
}

export async function updateLeadNotes(id: string, notes: string) {
  return prisma.lead.update({ where: { id }, data: { notes } });
}
