import { NextRequest, NextResponse } from "next/server";
import { getRawFeed } from "@/lib/db/posts";
import type { Platform } from "@/types";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = sp.get("page") ? Number(sp.get("page")) : 1;
  const pageSize = sp.get("pageSize") ? Number(sp.get("pageSize")) : 20;
  const platform = sp.get("platform") as Platform | undefined ?? undefined;

  try {
    const result = await getRawFeed(page, pageSize, platform);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch raw feed" }, { status: 500 });
  }
}
