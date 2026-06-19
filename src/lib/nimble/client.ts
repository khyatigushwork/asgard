/**
 * Nimble API client
 * Endpoint: POST https://sdk.nimbleway.com/v1/extract
 * Auth:     Bearer token
 * Response: { status: "success", data: { html: "<json string>" } }
 */

import axios from "axios";

const NIMBLE_EXTRACT_URL = "https://sdk.nimbleway.com/v1/extract";
const NIMBLE_RETRIES = 2;

function getApiKey(): string {
  const key = process.env.NIMBLE_API_KEY;
  if (!key) throw new Error("NIMBLE_API_KEY is not set");
  return key;
}

interface NimbleExtractResponse {
  status: string;
  data: {
    html: string | Record<string, unknown>;
  };
}

/**
 * Fetch a URL through Nimble's Extract API.
 * Returns the raw body string (Reddit JSON endpoints return JSON text).
 * Retries on transient 5xx errors.
 */
export async function nimbleFetchUrl(url: string): Promise<string> {
  const apiKey = getApiKey();
  let lastErr: unknown;

  for (let attempt = 0; attempt <= NIMBLE_RETRIES; attempt++) {
    try {
      const res = await axios.post<NimbleExtractResponse>(
        NIMBLE_EXTRACT_URL,
        { url },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 120_000,
        }
      );

      const outer = res.data;
      if (outer.status !== "success") {
        throw new Error(`Nimble status=${outer.status}`);
      }

      const html = outer.data.html;
      return typeof html === "string" ? html : JSON.stringify(html);
    } catch (err) {
      lastErr = err;
      if (attempt < NIMBLE_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  throw lastErr;
}
