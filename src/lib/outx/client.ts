/**
 * OutX API client for LinkedIn data
 * Base URL: https://api.outx.ai
 * Auth:     x-api-key header
 *
 * Flow:
 *   1. POST /api-keyword-watchlist  — create/get a watchlist for a set of keywords
 *   2. GET  /api-posts              — fetch posts collected for that watchlist
 */

import axios, { AxiosInstance } from "axios";

const OUTX_BASE_URL = "https://api.outx.ai";
const OUTX_RETRIES = 2;

let outxClient: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!outxClient) {
    const apiKey = process.env.OUTX_API_KEY;
    if (!apiKey) throw new Error("OUTX_API_KEY is not set");

    outxClient = axios.create({
      baseURL: OUTX_BASE_URL,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 60_000,
    });
  }
  return outxClient;
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

export interface OutXWatchlistParams {
  name: string;
  keywords: string[];
  required_keywords?: string[];
  excluded_keywords?: string[];
  fetchFreqInHours?: number;
}

export interface OutXWatchlist {
  id: string;
  name: string;
  slug?: string;
  type?: string;
  keywords: string[];
  fetchFreqInHours?: number;
  created?: boolean;
}

export async function listWatchlists(): Promise<OutXWatchlist[]> {
  const client = getClient();
  const res = await client.get<OutXWatchlist[] | { data?: OutXWatchlist[] }>("/api-keyword-watchlist");
  const body = res.data;
  return Array.isArray(body) ? body : (body as { data?: OutXWatchlist[] }).data ?? [];
}

export async function createOrGetWatchlist(
  params: OutXWatchlistParams
): Promise<OutXWatchlist> {
  const client = getClient();
  const res = await client.post<OutXWatchlist>("/api-keyword-watchlist", {
    name: params.name,
    keywords: params.keywords,
    required_keywords: params.required_keywords ?? [],
    excluded_keywords: params.excluded_keywords ?? [],
    fetchFreqInHours: params.fetchFreqInHours ?? 6,
  });
  return res.data;
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export interface OutXPostsParams {
  watchlist_id?: string;
  slug?: string;
  start_date?: string;   // ISO date string e.g. "2026-06-12"
  end_date?: string;
  lang?: string;
  post_type?: "text" | "image" | "video" | "article";
  sort_by?: "recent" | "popular_first" | "engagement" | "relevance_first";
  page?: number;
  page_size?: number;
  search_term?: string;
  seniority_level?: string;
  relevance_level?: string;
}

export interface OutXPost {
  id?: string;
  urn?: string;
  // URL is returned as linkedin_post_url (a slug) — prepend base URL to use it
  linkedin_post_url?: string;
  url?: string;
  // Content is returned as "content" field
  content?: string;
  text?: string;
  author?: {
    id?: string;
    name?: string;
    headline?: string;
    profile_url?: string;
    company?: string;
  };
  // Author info may be at top level
  author_name?: string;
  author_headline?: string;
  author_linkedin_url?: string;
  company?: {
    id?: string;
    name?: string;
    url?: string;
  };
  company_name?: string;
  likes?: number;
  num_likes?: number;
  comments?: number;
  num_comments?: number;
  shares?: number;
  posted_at?: string;
  created_at?: string;
  post_date?: string;
  tracking_list_id?: string;
}

export interface OutXPostsResponse {
  data?: OutXPost[];
  posts?: OutXPost[];
  items?: OutXPost[];
  total?: number;
  page?: number;
  has_more?: boolean;
}

export async function fetchWatchlistPosts(
  params: OutXPostsParams
): Promise<OutXPost[]> {
  const client = getClient();
  let lastErr: unknown;

  for (let attempt = 0; attempt <= OUTX_RETRIES; attempt++) {
    try {
      const res = await client.get<OutXPostsResponse>("/api-posts", {
        params: {
          ...(params.watchlist_id ? { watchlist_id: params.watchlist_id } : {}),
          ...(params.slug ? { slug: params.slug } : {}),
          ...(params.start_date ? { start_date: params.start_date } : {}),
          ...(params.end_date ? { end_date: params.end_date } : {}),
          ...(params.search_term ? { search_term: params.search_term } : {}),
          lang: params.lang ?? "en",
          sort_by: params.sort_by ?? "recent",
          page: params.page ?? 1,
          page_size: params.page_size ?? 100,
        },
      });
      const body = res.data;
      return body.data ?? body.posts ?? body.items ?? [];
    } catch (err) {
      lastErr = err;
      if (attempt < OUTX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
