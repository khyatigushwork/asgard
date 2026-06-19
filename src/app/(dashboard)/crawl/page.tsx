"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Play, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";

interface CrawlJob {
  id: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  postsFound: number;
  postsProcessed: number;
  error?: string;
  createdAt: string;
  config: Record<string, unknown>;
}

const PLATFORMS = ["REDDIT"];

export default function CrawlPage() {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(PLATFORMS);
  const [maxPerPlatform, setMaxPerPlatform] = useState(30);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/crawl");
      const data = await res.json();
      setJobs(data ?? []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const startCrawl = async () => {
    if (selectedPlatforms.length === 0) return;
    setCrawling(true);
    try {
      await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          maxPerPlatform,
          qualify: true,
        }),
      });
      setTimeout(() => { fetchJobs(); setCrawling(false); }, 2000);
    } catch {
      setCrawling(false);
    }
  };

  const startQualification = async () => {
    setQualifying(true);
    await fetch("/api/qualify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 100 }),
    });
    setTimeout(() => setQualifying(false), 2000);
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const statusIcon = (status: string) => {
    if (status === "COMPLETED") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (status === "FAILED") return <XCircle className="w-4 h-4 text-red-400" />;
    if (status === "RUNNING") return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    return <Clock className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Crawl & Import</h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">Trigger data collection from industrial platforms</p>
        </div>
        <button
          onClick={fetchJobs}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Crawl Config */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">New Crawl</h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-900/40 border border-blue-700/40 text-blue-400">
            Last 3 days only
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Platforms to crawl</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                    selectedPlatforms.includes(p)
                      ? "bg-blue-600/20 border-blue-600/50 text-blue-400"
                      : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {p === "INDUSTRY_FORUMS" ? "Industry Forums" : p.charAt(0) + p.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Max posts per platform: <span className="text-white font-medium">{maxPerPlatform}</span>
            </label>
            <input
              type="range"
              min="10"
              max="100"
              step="10"
              value={maxPerPlatform}
              onChange={(e) => setMaxPerPlatform(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>10 (fast)</span>
              <span>100 (thorough)</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={startCrawl}
              disabled={crawling || selectedPlatforms.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
            >
              {crawling ? (
                <><Loader2 size={14} className="animate-spin" /> Starting...</>
              ) : (
                <><Play size={14} /> Start Crawl</>
              )}
            </button>

            <button
              onClick={startQualification}
              disabled={qualifying}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/40 disabled:opacity-50 rounded-lg text-sm text-purple-400 font-medium transition-colors"
            >
              {qualifying ? (
                <><Loader2 size={14} className="animate-spin" /> Running AI...</>
              ) : (
                "Run AI Qualification Only"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Info */}
      <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
        <p className="text-sm text-amber-400 font-medium mb-1">Scheduled Crawling</p>
        <p className="text-xs text-amber-400/70">
          The background worker runs automatic crawls every 6 hours and AI qualification every 30 minutes.
          Start the worker with <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">npm run worker</code>.
        </p>
      </div>

      {/* Crawl History */}
      <div>
        <h2 className="font-semibold text-white mb-3">Crawl History</h2>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-10 text-gray-600">No crawl history yet</div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex items-center gap-4"
              >
                {statusIcon(job.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${
                      job.status === "COMPLETED" ? "text-emerald-400" :
                      job.status === "FAILED" ? "text-red-400" :
                      job.status === "RUNNING" ? "text-blue-400" : "text-gray-400"
                    }`}>
                      {job.status}
                    </span>
                    <span className="text-xs text-gray-600">{formatRelativeDate(job.createdAt)}</span>
                    {(job.config?.platforms as string[])?.length > 0 && (
                      <span className="text-xs text-gray-600">
                        {(job.config.platforms as string[]).join(", ")}
                      </span>
                    )}
                  </div>
                  {job.error && (
                    <p className="text-xs text-red-400 mt-0.5">{job.error}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>{job.postsFound} fetched</div>
                  <div>{job.postsProcessed} saved</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
