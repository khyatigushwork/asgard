import { ApifyClient } from "apify-client";

let apifyClient: ApifyClient | null = null;

export function getApifyClient(): ApifyClient {
  if (!apifyClient) {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error("APIFY_API_TOKEN is not set");
    apifyClient = new ApifyClient({ token });
  }
  return apifyClient;
}

export const APIFY_ACTORS = {
  REDDIT_SCRAPER: "trudax/reddit-scraper-lite",
  REDDIT_COMMENTS: "epctex/reddit-scraper",
  QUORA_SCRAPER: "apify/quora-scraper",
  TWITTER_SCRAPER: "apidojo/tweet-scraper",
  TWITTER_SEARCH: "apidojo/tweet-scraper",
  WEB_SCRAPER: "apify/web-scraper",
  CHEERIO_SCRAPER: "apify/cheerio-scraper",
} as const;

export interface ActorRunOptions {
  actorId: string;
  input: Record<string, unknown>;
  timeoutSecs?: number;
  memoryMbytes?: number;
}

export interface ApifyDataset {
  items: Record<string, unknown>[];
}

export async function runActorAndGetResults(
  options: ActorRunOptions
): Promise<Record<string, unknown>[]> {
  const client = getApifyClient();

  // Newer apify-client SDK does not accept timeoutSecs/memoryMbytes in call()
  const run = await client.actor(options.actorId).call(options.input);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items as Record<string, unknown>[];
}

export async function runActorAsync(
  options: ActorRunOptions
): Promise<string> {
  const client = getApifyClient();

  const run = await client.actor(options.actorId).start(options.input);

  return run.id;
}

export async function getRunResults(runId: string): Promise<{
  status: string;
  datasetId?: string;
  items?: Record<string, unknown>[];
}> {
  const client = getApifyClient();
  const run = await client.run(runId).get();

  if (!run) return { status: "UNKNOWN" };

  if (run.status === "SUCCEEDED" && run.defaultDatasetId) {
    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 1000 });
    return {
      status: run.status,
      datasetId: run.defaultDatasetId,
      items: items as Record<string, unknown>[],
    };
  }

  return { status: run.status };
}
