"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreRing } from "@/components/ScoreRing";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  Building2,
  User,
  Tag,
  Target,
  Lightbulb,
  Clock,
  Package,
  Brain,
  Archive,
} from "lucide-react";
import {
  getPlatformIcon,
  getPlatformLabel,
  getUrgencyColor,
  formatRelativeDate,
} from "@/lib/utils";

interface LeadDetail {
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
  productCategory?: string;
  machineCategory?: string;
  serviceCategory?: string;
  urgency: string;
  projectSize: string;
  customizationLevel?: string;
  customSolutionNeeded: boolean;
  isQualified: boolean;
  notes?: string;
  createdAt: string;
  rawPost?: {
    content: string;
    postedAt?: string;
    upvotes: number;
    comments: number;
  };
  aiAnalysis?: {
    reasoning?: string;
    b2bRelevance: number;
    manufacturingReq: number;
    engineeringReq: number;
    industrialRelevance: number;
    rawResponse?: Record<string, unknown>;
  };
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-300">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/leads/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setLead(data);
        setNotes(data.notes ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  const saveNotes = async () => {
    setSaving(true);
    await fetch(`/api/leads/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
  };

  const archive = async () => {
    if (!confirm("Archive this lead?")) return;
    await fetch(`/api/leads/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    router.push("/leads");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 text-center text-gray-500">Lead not found</div>
    );
  }

  const breakdown = (lead.aiAnalysis?.rawResponse as Record<string, unknown>)
    ?.score_breakdown as Record<string, number> | undefined;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Back to Leads
        </button>
        <div className="flex gap-2">
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 border border-blue-600/40 text-blue-400 rounded-lg text-sm hover:bg-blue-600/30 transition-colors"
          >
            <ExternalLink size={14} /> View Source
          </a>
          <button
            onClick={archive}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 rounded-lg text-sm hover:text-gray-200 transition-colors"
          >
            <Archive size={14} /> Archive
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Lead Summary */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{getPlatformIcon(lead.platform)}</span>
              <span className="text-sm text-gray-500">{getPlatformLabel(lead.platform)}</span>
              {lead.isQualified && (
                <Badge variant="success">✓ Qualified Lead</Badge>
              )}
            </div>

            {lead.problemStatement && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <Target size={12} /> PROBLEM STATEMENT
                </div>
                <p className="text-gray-200 font-medium">{lead.problemStatement}</p>
              </div>
            )}

            {lead.requiredSolution && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <Lightbulb size={12} /> REQUIRED SOLUTION
                </div>
                <p className="text-gray-300">{lead.requiredSolution}</p>
              </div>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {lead.industry && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 size={14} className="text-gray-500" />
                  <span className="text-gray-400">Industry:</span>
                  <span className="text-gray-200">{lead.industry}</span>
                </div>
              )}
              {lead.likelyRole && (
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-gray-500" />
                  <span className="text-gray-400">Role:</span>
                  <span className="text-gray-200">{lead.likelyRole}</span>
                </div>
              )}
              {lead.urgency !== "UNKNOWN" && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-gray-500" />
                  <span className="text-gray-400">Urgency:</span>
                  <span className={getUrgencyColor(lead.urgency)}>
                    {lead.urgency.replace("_", " ")}
                  </span>
                </div>
              )}
              {lead.projectSize !== "UNKNOWN" && (
                <div className="flex items-center gap-2 text-sm">
                  <Package size={14} className="text-gray-500" />
                  <span className="text-gray-400">Project Size:</span>
                  <span className="text-gray-200">{lead.projectSize}</span>
                </div>
              )}
              {lead.productCategory && (
                <div className="flex items-center gap-2 text-sm">
                  <Tag size={14} className="text-gray-500" />
                  <span className="text-gray-400">Product:</span>
                  <span className="text-gray-200">{lead.productCategory}</span>
                </div>
              )}
              {lead.machineCategory && (
                <div className="flex items-center gap-2 text-sm">
                  <Tag size={14} className="text-gray-500" />
                  <span className="text-gray-400">Machine:</span>
                  <span className="text-gray-200">{lead.machineCategory}</span>
                </div>
              )}
            </div>

            {lead.customSolutionNeeded && (
              <div className="mt-3">
                <Badge variant="info">Custom Solution Required</Badge>
              </div>
            )}
          </div>

          {/* Original Post */}
          {lead.rawPost?.content && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <span className="text-base">{getPlatformIcon(lead.platform)}</span>
                Original Post
              </h3>
              <div className="bg-gray-950/60 rounded-lg p-4 border border-gray-800/50">
                <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                  {lead.rawPost.content.substring(0, 2000)}
                  {lead.rawPost.content.length > 2000 && "..."}
                </p>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-600">
                {lead.rawPost.postedAt && (
                  <span>Posted {formatRelativeDate(lead.rawPost.postedAt)}</span>
                )}
                <span>↑ {lead.rawPost.upvotes} upvotes</span>
                <span>💬 {lead.rawPost.comments} comments</span>
              </div>
            </div>
          )}

          {/* AI Reasoning */}
          {lead.aiAnalysis?.reasoning && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Brain size={14} className="text-purple-400" />
                AI Analysis Reasoning
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {lead.aiAnalysis.reasoning}
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about this lead..."
              className="w-full bg-gray-950/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none transition-colors"
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Notes"}
            </button>
          </div>
        </div>

        {/* Score Panel */}
        <div className="space-y-4">
          {/* Scores */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Lead Scores</h3>
            <div className="flex justify-around mb-4">
              <ScoreRing score={lead.buyerIntentScore} label="Buyer Intent" size="lg" />
              <ScoreRing score={lead.delfinFitScore} label="Delfin Fit" size="lg" />
            </div>
            <div className="mt-4">
              <ScoreRing score={lead.confidenceScore} label="AI Confidence" size="sm" />
            </div>
          </div>

          {/* Score Breakdown */}
          {breakdown && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Score Breakdown</h3>
              <div className="space-y-3">
                <ScoreBar label="B2B Relevance" value={breakdown.b2b_relevance ?? 0} />
                <ScoreBar label="Manufacturing Req." value={breakdown.manufacturing_requirement ?? 0} />
                <ScoreBar label="Engineering Req." value={breakdown.engineering_requirement ?? 0} />
                <ScoreBar label="Industrial Relevance" value={breakdown.industrial_relevance ?? 0} />
                <ScoreBar label="Supplier Discovery" value={breakdown.supplier_discovery_need ?? 0} />
                <ScoreBar label="Project Value" value={breakdown.potential_project_value ?? 0} />
                <ScoreBar label="Customization Req." value={breakdown.customization_requirement ?? 0} />
              </div>
            </div>
          )}

          {/* Author Info */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Source Info</h3>
            <div className="space-y-2 text-sm">
              {lead.author && (
                <div className="flex gap-2">
                  <span className="text-gray-500">Author:</span>
                  <span className="text-gray-300">@{lead.author}</span>
                </div>
              )}
              {lead.companyType && (
                <div className="flex gap-2">
                  <span className="text-gray-500">Company:</span>
                  <span className="text-gray-300">{lead.companyType}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-gray-500">Discovered:</span>
                <span className="text-gray-300">{formatRelativeDate(lead.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
