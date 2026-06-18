import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/db/leads";
import type { LeadFilters, Platform, Urgency, ProjectSize } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const filters: LeadFilters = {
      platform: sp.get("platform") as Platform | undefined ?? undefined,
      industry: sp.get("industry") ?? undefined,
      minBuyerIntent: sp.get("minBuyerIntent") ? Number(sp.get("minBuyerIntent")) : undefined,
      maxBuyerIntent: sp.get("maxBuyerIntent") ? Number(sp.get("maxBuyerIntent")) : undefined,
      minDelfinFit: sp.get("minDelfinFit") ? Number(sp.get("minDelfinFit")) : undefined,
      maxDelfinFit: sp.get("maxDelfinFit") ? Number(sp.get("maxDelfinFit")) : undefined,
      urgency: sp.get("urgency") as Urgency | undefined ?? undefined,
      projectSize: sp.get("projectSize") as ProjectSize | undefined ?? undefined,
      customSolutionNeeded: sp.has("customSolutionNeeded")
        ? sp.get("customSolutionNeeded") === "true"
        : undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      search: sp.get("search") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 20,
      sortBy: sp.get("sortBy") ?? "buyerIntentScore",
      sortOrder: (sp.get("sortOrder") as "asc" | "desc") ?? "desc",
      isQualified: sp.has("qualified") ? sp.get("qualified") === "true" : undefined,
    };

    const onlyQualified = sp.get("qualified") === "true";
    const result = await getLeads(filters, onlyQualified);
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/leads error:", err);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
