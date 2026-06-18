import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Default qualification threshold
  await prisma.qualificationThreshold.upsert({
    where: { id: "default-threshold" },
    update: {},
    create: {
      id: "default-threshold",
      name: "default",
      minBuyerIntentScore: 70,
      minDelfinFitScore: 70,
      minConfidenceScore: 70,
      isActive: true,
    },
  });

  // Platform configs
  const platforms = [
    {
      platform: "REDDIT" as const,
      searchTerms: [
        "looking for manufacturer",
        "need supplier",
        "custom fabrication",
        "OEM supplier",
        "CNC machining quote",
        "automation solution",
        "engineering services",
      ],
      keywords: ["manufacturer", "supplier", "fabrication", "machining", "automation"],
      excludeTerms: ["hiring", "job", "salary", "resume"],
      maxResults: 50,
      crawlIntervalHours: 6,
    },
    {
      platform: "QUORA" as const,
      searchTerms: [
        "how to find manufacturer",
        "looking for supplier industrial",
        "custom manufacturing recommendation",
      ],
      keywords: ["manufacturer", "supplier", "industrial"],
      excludeTerms: [],
      maxResults: 30,
      crawlIntervalHours: 12,
    },
    {
      platform: "TWITTER" as const,
      searchTerms: [
        "need manufacturer OR supplier industrial",
        "RFQ manufacturer",
        "automation solution needed",
      ],
      keywords: ["manufacturer", "supplier", "RFQ", "automation"],
      excludeTerms: ["hiring", "job"],
      maxResults: 50,
      crawlIntervalHours: 3,
    },
    {
      platform: "INDUSTRY_FORUMS" as const,
      searchTerms: [],
      keywords: ["supplier", "manufacturer", "fabrication"],
      excludeTerms: [],
      maxResults: 30,
      crawlIntervalHours: 24,
    },
  ];

  for (const config of platforms) {
    await prisma.platformConfig.upsert({
      where: { platform: config.platform },
      update: config,
      create: config,
    });
  }

  // Default source
  await prisma.source.upsert({
    where: { id: "default-source" },
    update: {},
    create: {
      id: "default-source",
      name: "Default",
      platform: "REDDIT",
      apifyActorId: "trudax/reddit-scraper-lite",
      description: "Default multi-platform source",
    },
  });

  console.log("✅ Seed data created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
