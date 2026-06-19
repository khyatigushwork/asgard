"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LeadCard } from "@/components/LeadCard";
import { FilterBar } from "@/components/FilterBar";
import { Star, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Lead {
  id: string;
  platform: string;
  url: string;
  author?: string;
  title?: string;
  buyerIntentScore: number;
  delfinFitScore: number;
  confidenceScore: number;
  industry?: string;
  companyType?: string;
  likelyRole?: string;
  problemStatement?: string;
  requiredSolution?: string;
  urgency: string;
  projectSize: string;
  customSolutionNeeded: boolean;
  isQualified: boolean;
  createdAt: string;
}

interface PaginatedResult {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  REDDIT: "#ff4500",
  LINKEDIN: "#0077b5",
  TWITTER: "#1da1f2",
  QUORA: "#b92b27",
  OTHER: "#6b7280",
};

const PLATFORM_LABELS: Record<string, string> = {
  REDDIT: "Reddit",
  LINKEDIN: "LinkedIn",
  TWITTER: "Twitter / X",
  QUORA: "Quora",
  OTHER: "Other",
};

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{ borderColor: `${PLATFORM_COLORS[platform] ?? "#6b7280"}40`, color: PLATFORM_COLORS[platform] ?? "#9ca3af", backgroundColor: `${PLATFORM_COLORS[platform] ?? "#6b7280"}15` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform] ?? "#6b7280" }} />
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

function LeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isQualifiedView = searchParams.get("qualified") !== "false";
  const activePlatform = searchParams.get("platform") ?? "ALL";

  const [result, setResult] = useState<PaginatedResult | null>(null);
  const [platformCounts, setPlatformCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...filters,
        page: String(page),
        pageSize: "20",
        ...(isQualifiedView ? { qualified: "true" } : {}),
        ...(activePlatform !== "ALL" ? { platform: activePlatform } : {}),
      });
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setResult(data);
    } catch {}
    setLoading(false);
  }, [filters, page, isQualifiedView, activePlatform]);

  // Fetch per-platform counts
  const fetchCounts = useCallback(async () => {
    try {
      const platforms = ["REDDIT", "LINKEDIN", "TWITTER"];
      const counts: Record<string, number> = { ALL: 0 };
      await Promise.all(platforms.map(async (p) => {
        const params = new URLSearchParams({ platform: p, pageSize: "1", ...(isQualifiedView ? { qualified: "true" } : {}) });
        const res = await fetch(`/api/leads?${params}`);
        const data = await res.json();
        counts[p] = data.total ?? 0;
        counts.ALL = (counts.ALL ?? 0) + (data.total ?? 0);
      }));
      setPlatformCounts(counts);
    } catch {}
  }, [isQualifiedView]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const handleFilterChange = (newFilters: Record<string, string>) => {
    setFilters(newFilters);
    setPage(1);
  };

  const setActivePlatform = (p: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p === "ALL") params.delete("platform");
    else params.set("platform", p);
    router.push(`/leads?${params.toString()}`);
    setPage(1);
  };

  const PLATFORM_TABS = ["ALL", "REDDIT", "LINKEDIN", "TWITTER"];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            <h1 className="text-2xl font-bold text-white">
              {isQualifiedView ? "Qualified Leads" : "All Leads"}
            </h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {isQualifiedView ? "Buyer Intent ≥70 and Asgard Fit ≥70" : "All analyzed leads sorted by relevance"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/leads?qualified=true")}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isQualifiedView ? "bg-amber-600/20 border border-amber-600/40 text-amber-400" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200"}`}>
            Qualified Only
          </button>
          <button onClick={() => router.push("/leads?qualified=false")}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${!isQualifiedView ? "bg-blue-600/20 border border-blue-600/40 text-blue-400" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200"}`}>
            All Leads
          </button>
        </div>
      </div>

      {/* Platform Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        {PLATFORM_TABS.map((p) => (
          <button key={p} onClick={() => setActivePlatform(p)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activePlatform === p
                ? "border-white text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>
            {p !== "ALL" && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[p] }} />}
            {p === "ALL" ? "All Platforms" : PLATFORM_LABELS[p]}
            {platformCounts[p] !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activePlatform === p ? "bg-gray-700 text-gray-300" : "bg-gray-800 text-gray-600"}`}>
                {platformCounts[p]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <FilterBar onFilterChange={handleFilterChange} initialFilters={filters} />

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : result && result.data.length > 0 ? (
        <>
          <div className="text-xs text-gray-600">{result.total} leads found</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {result.data.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onClick={() => router.push(`/leads/${lead.id}`)} />
            ))}
          </div>

          {result.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 disabled:opacity-40 hover:text-gray-200 transition-colors">
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {result.totalPages}</span>
              <button disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 disabled:opacity-40 hover:text-gray-200 transition-colors">
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <Star className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No leads found</p>
          <p className="text-gray-600 text-sm mt-1">
            {activePlatform !== "ALL" ? `No ${PLATFORM_LABELS[activePlatform]} leads yet` : isQualifiedView ? "Start a crawl to discover industrial buyers" : "Try adjusting your filters"}
          </p>
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>}>
      <LeadsContent />
    </Suspense>
  );
}
