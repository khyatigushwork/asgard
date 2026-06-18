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

function LeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isQualifiedView = searchParams.get("qualified") !== "false";

  const [result, setResult] = useState<PaginatedResult | null>(null);
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
      });
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setResult(data);
    } catch {}
    setLoading(false);
  }, [filters, page, isQualifiedView]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleFilterChange = (newFilters: Record<string, string>) => {
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            <h1 className="text-2xl font-bold text-white">
              {isQualifiedView ? "Qualified Leads" : "All Leads"}
            </h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {isQualifiedView
              ? "Buyer Intent ≥70 and Asgard Fit ≥70"
              : "All analyzed leads sorted by relevance"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/leads?qualified=true")}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isQualifiedView
                ? "bg-amber-600/20 border border-amber-600/40 text-amber-400"
                : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            Qualified Only
          </button>
          <button
            onClick={() => router.push("/leads?qualified=false")}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !isQualifiedView
                ? "bg-blue-600/20 border border-blue-600/40 text-blue-400"
                : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            All Leads
          </button>
        </div>
      </div>

      <FilterBar onFilterChange={handleFilterChange} initialFilters={filters} />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : result && result.data.length > 0 ? (
        <>
          <div className="text-xs text-gray-600">
            {result.total} leads found
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {result.data.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => router.push(`/leads/${lead.id}`)}
              />
            ))}
          </div>

          {result.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 disabled:opacity-40 hover:text-gray-200 transition-colors"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {result.totalPages}
              </span>
              <button
                disabled={page >= result.totalPages}
                onClick={() => setPage(page + 1)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 disabled:opacity-40 hover:text-gray-200 transition-colors"
              >
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
            {isQualifiedView
              ? "Start a crawl to discover industrial buyers"
              : "Try adjusting your filters"}
          </p>
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    }>
      <LeadsContent />
    </Suspense>
  );
}
