"use client";
import { useState } from "react";
import { ScoreRing } from "./ScoreRing";
import { Badge } from "./ui/badge";
import {
  getPlatformIcon,
  getPlatformLabel,
  getUrgencyColor,
  formatRelativeDate,
} from "@/lib/utils";
import { ExternalLink, Building2, User, Zap, CheckCircle2, Circle } from "lucide-react";

interface LeadCardProps {
  lead: {
    id: string;
    platform: string;
    url: string;
    author?: string | null;
    title?: string | null;
    buyerIntentScore: number;
    delfinFitScore: number;
    confidenceScore: number;
    industry?: string | null;
    companyType?: string | null;
    likelyRole?: string | null;
    problemStatement?: string | null;
    requiredSolution?: string | null;
    urgency: string;
    projectSize: string;
    customSolutionNeeded: boolean;
    isQualified: boolean;
    contacted?: boolean;
    createdAt: string | Date;
  };
  onClick?: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const [contacted, setContacted] = useState(lead.contacted ?? false);
  const [loading, setLoading] = useState(false);

  async function toggleContacted(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    const next = !contacted;
    setContacted(next);
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacted: next }),
      });
    } catch {
      setContacted(!next); // revert on error
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClick}
      className={`bg-gray-900/60 border rounded-xl p-4 hover:border-blue-600/50 hover:bg-gray-900/80 transition-all cursor-pointer group ${contacted ? "border-green-700/60" : "border-gray-800"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">{getPlatformIcon(lead.platform)}</span>
            <span className="text-xs text-gray-500">{getPlatformLabel(lead.platform)}</span>
            {lead.isQualified && (
              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                ✓ Qualified
              </Badge>
            )}
            {lead.urgency === "IMMEDIATE" && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                <Zap className="w-2.5 h-2.5 mr-0.5" /> Urgent
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-gray-200 line-clamp-2 group-hover:text-white transition-colors">
            {lead.problemStatement ?? lead.title ?? "Industrial procurement inquiry"}
          </p>
        </div>

        {/* Score rings */}
        <div className="flex gap-3 shrink-0">
          <ScoreRing score={lead.buyerIntentScore} label="Intent" size="sm" />
          <ScoreRing score={lead.delfinFitScore} label="Fit" size="sm" />
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-2 mb-3">
        {lead.industry && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Building2 className="w-3 h-3" />
            {lead.industry}
          </div>
        )}
        {lead.likelyRole && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <User className="w-3 h-3" />
            {lead.likelyRole}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {lead.customSolutionNeeded && (
          <Badge variant="info" className="text-[10px]">Custom Solution</Badge>
        )}
        {lead.projectSize !== "UNKNOWN" && (
          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">
            {lead.projectSize.charAt(0) + lead.projectSize.slice(1).toLowerCase()} Project
          </Badge>
        )}
        {lead.urgency !== "UNKNOWN" && (
          <Badge variant="outline" className={`text-[10px] border-gray-700 ${getUrgencyColor(lead.urgency)}`}>
            {lead.urgency.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
          </Badge>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-3">
          <span>{formatRelativeDate(lead.createdAt)}</span>
          {lead.isQualified && (
            <button
              onClick={toggleContacted}
              disabled={loading}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                contacted
                  ? "text-green-400 hover:text-green-300"
                  : "text-gray-500 hover:text-green-400"
              }`}
              title={contacted ? "Mark as not contacted" : "Mark as contacted"}
            >
              {contacted ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              {contacted ? "Contacted" : "Mark contacted"}
            </button>
          )}
        </div>
        <a
          href={lead.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-blue-500 hover:text-blue-400 transition-colors"
        >
          View source <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
