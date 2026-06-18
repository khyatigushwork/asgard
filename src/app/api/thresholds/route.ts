import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/client";

export async function GET() {
  try {
    let threshold = await prisma.qualificationThreshold.findFirst({
      where: { isActive: true },
    });
    if (!threshold) {
      threshold = await prisma.qualificationThreshold.create({
        data: { name: "default", minBuyerIntentScore: 70, minDelfinFitScore: 70, minConfidenceScore: 70 },
      });
    }
    return NextResponse.json(threshold);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch thresholds" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { minBuyerIntentScore, minDelfinFitScore, minConfidenceScore } = body;

    let threshold = await prisma.qualificationThreshold.findFirst({
      where: { isActive: true },
    });

    if (threshold) {
      threshold = await prisma.qualificationThreshold.update({
        where: { id: threshold.id },
        data: {
          ...(minBuyerIntentScore !== undefined ? { minBuyerIntentScore } : {}),
          ...(minDelfinFitScore !== undefined ? { minDelfinFitScore } : {}),
          ...(minConfidenceScore !== undefined ? { minConfidenceScore } : {}),
        },
      });
    } else {
      threshold = await prisma.qualificationThreshold.create({
        data: { minBuyerIntentScore: 70, minDelfinFitScore: 70, minConfidenceScore: 70 },
      });
    }

    return NextResponse.json(threshold);
  } catch (err) {
    return NextResponse.json({ error: "Failed to update thresholds" }, { status: 500 });
  }
}
