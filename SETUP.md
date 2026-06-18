# Industrial Buyer Discovery Platform — Setup Guide

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- Apify API token (https://apify.com)
- Anthropic API key (https://console.anthropic.com)

## Quick Start

```bash
# 1. Clone and install
cd industrial-buyer-discovery
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start PostgreSQL
docker-compose up -d postgres

# 4. Initialize database
npx prisma generate
npx prisma db push
npm run db:seed

# 5. Start the app
npm run dev        # Dashboard: http://localhost:3000
npm run worker     # Background crawler (separate terminal)
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Next.js Dashboard (localhost:3000)              │
│  ├── / (Analytics)                               │
│  ├── /leads (Qualified Leads)                    │
│  ├── /raw-feed (All Posts)                       │
│  ├── /crawl (Trigger Crawls)                     │
│  └── /settings (Thresholds)                      │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────┐
│  API Routes (/api/*)                             │
│  ├── /api/leads          GET, PATCH              │
│  ├── /api/leads/[id]     GET, PATCH              │
│  ├── /api/analytics      GET                     │
│  ├── /api/raw-feed       GET                     │
│  ├── /api/crawl          GET, POST               │
│  ├── /api/qualify        POST                    │
│  └── /api/thresholds     GET, PUT                │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│  Data Layer                                      │
│  ├── Apify Scrapers                              │
│  │   ├── Reddit (subreddits + search)            │
│  │   ├── Quora (industrial topics)               │
│  │   ├── Twitter/X (search)                      │
│  │   └── Industry Forums (web scraping)          │
│  ├── AI Qualification Agent (Claude Sonnet)      │
│  │   ├── Buyer Intent Score (0-100)              │
│  │   ├── Delfin Fit Score (0-100)                │
│  │   ├── Confidence Score                        │
│  │   └── Structured lead extraction             │
│  └── PostgreSQL (Prisma ORM)                     │
│      ├── raw_posts                               │
│      ├── ai_analysis                             │
│      ├── leads                                   │
│      ├── sources                                 │
│      ├── crawl_jobs                              │
│      └── platform_configs                        │
└──────────────────────────────────────────────────┘

Worker (npm run worker)
├── Crawl: Every 6 hours (configurable via CRAWL_SCHEDULE)
└── Qualify: Every 30 minutes (configurable via QUALIFY_SCHEDULE)
```

## Buyer Intent Scoring

| Score | Meaning |
|-------|---------|
| 90-100 | Active procurement signal |
| 75-89 | Strong buyer signal |
| 50-74 | Potential future buyer |
| 25-49 | Weak signal |
| 0-24 | No buyer intent |

## Delfin Fit Score Factors

- B2B relevance
- Customization requirement
- Manufacturing requirement
- Engineering requirement
- Industrial relevance
- Supplier discovery need
- Potential project value

## Lead Qualification Rules

A lead is qualified when:
- Buyer Intent Score ≥ 70
- AND Delfin Fit Score ≥ 70
- (configurable in /settings)

## Adding New Platforms

1. Create a scraper in `src/lib/apify/scrapers/newplatform.ts`
2. Add platform enum value in `prisma/schema.prisma`
3. Import and add case in `src/lib/apify/orchestrator.ts`
4. Add to `PLATFORMS` list in crawl page

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `APIFY_API_TOKEN` | Apify API token |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `CRAWL_SCHEDULE` | Cron for crawl (default: `0 */6 * * *`) |
| `QUALIFY_SCHEDULE` | Cron for AI qualification (default: `*/30 * * * *`) |
| `RUN_ON_START` | Run crawl immediately on worker start |
