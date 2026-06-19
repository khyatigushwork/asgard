"use client";
import { useEffect, useState, useCallback } from "react";
import { getPlatformIcon, getPlatformLabel, formatRelativeDate } from "@/lib/utils";
import { Inbox, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface RawPost {
  id: string;
  platform: string;
  url: string;
  title?: string;
  content: string;
  author?: string;
  upvotes: number;
  comments: number;
  fetchedAt: string;
  isProcessed: boolean;
  aiAnalysis?: {
    buyerIntentScore: number;
    delfinFitScore: number;
    isQualifiedLead: boolean;
  } | null;
}

const PLATFORMS = [
  { value: "", label: "All Platforms" },
  { value: "REDDIT", label: "Reddit" },
  { value: "QUORA", label: "Quora" },
  { value: "TWITTER", label: "Twitter/X" },
  { value: "INDUSTRY_FORUMS", label: "Industry Forums" },
];

export default function RawFeedPage() {
  const [posts, setPosts] = useState<RawPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("");
  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (platform) params.set("platform", platform);
      const res = await fetch(`/api/raw-feed?${params}`);
      const data = await res.json();
      setPosts(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {}
    setLoading(false);
  }, [page, platform]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Raw Feed</h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">All collected posts before qualification ({total} total)</p>
        </div>
        <select
          value={platform}
          onChange={(e) => { setPlatform(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-600"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span>{getPlatformIcon(post.platform)}</span>
                    <span className="text-xs text-gray-500">{getPlatformLabel(post.platform)}</span>
                    {post.author && (
                      <span className="text-xs text-gray-600">@{post.author}</span>
                    )}
                    <span className="text-xs text-gray-700">·</span>
                    <span className="text-xs text-gray-600">{formatRelativeDate(post.fetchedAt)}</span>
                    {!post.isProcessed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/40 text-amber-400">
                        Pending Analysis
                      </span>
                    )}
                    {post.aiAnalysis?.isQualifiedLead && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/40 text-emerald-400">
                        ✓ Qualified
                      </span>
                    )}
                  </div>
                  {post.title && (
                    <p className="text-sm font-medium text-gray-200 mb-1 line-clamp-1">{post.title}</p>
                  )}
                  <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                    {post.content.substring(0, 300)}
                  </p>
                </div>

                {/* Score pills */}
                {post.aiAnalysis && (
                  <div className="flex flex-col gap-1.5 shrink-0 text-center">
                    <div className="text-[10px] text-gray-600">Intent</div>
                    <div className={`text-sm font-bold ${
                      post.aiAnalysis.buyerIntentScore >= 70 ? "text-emerald-400" :
                      post.aiAnalysis.buyerIntentScore >= 50 ? "text-amber-400" : "text-gray-500"
                    }`}>
                      {Math.round(post.aiAnalysis.buyerIntentScore)}
                    </div>
                    <div className="text-[10px] text-gray-600">Fit</div>
                    <div className={`text-sm font-bold ${
                      post.aiAnalysis.delfinFitScore >= 70 ? "text-emerald-400" :
                      post.aiAnalysis.delfinFitScore >= 50 ? "text-amber-400" : "text-gray-500"
                    }`}>
                      {Math.round(post.aiAnalysis.delfinFitScore)}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                <div className="flex gap-3">
                  {post.upvotes > 0 && <span>↑ {post.upvotes}</span>}
                  {post.comments > 0 && <span>💬 {post.comments}</span>}
                </div>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-400 transition-colors"
                >
                  Source <ExternalLink size={11} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 disabled:opacity-40 hover:text-gray-200"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 disabled:opacity-40 hover:text-gray-200"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
