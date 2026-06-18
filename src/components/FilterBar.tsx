"use client";
import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface FilterBarProps {
  onFilterChange: (filters: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}

const PLATFORMS = [
  { value: "", label: "All Platforms" },
  { value: "REDDIT", label: "Reddit" },
  { value: "QUORA", label: "Quora" },
  { value: "TWITTER", label: "Twitter/X" },
  { value: "INDUSTRY_FORUMS", label: "Industry Forums" },
];

const URGENCY_OPTIONS = [
  { value: "", label: "Any Urgency" },
  { value: "IMMEDIATE", label: "Immediate" },
  { value: "SHORT_TERM", label: "Short Term" },
  { value: "MEDIUM_TERM", label: "Medium Term" },
  { value: "LONG_TERM", label: "Long Term" },
];

const PROJECT_SIZE_OPTIONS = [
  { value: "", label: "Any Size" },
  { value: "SMALL", label: "Small" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LARGE", label: "Large" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

export function FilterBar({ onFilterChange, initialFilters = {} }: FilterBarProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    if (!value) delete next[key];
    setFilters(next);
    onFilterChange(next);
  };

  const clear = () => {
    setFilters({});
    onFilterChange({});
  };

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="space-y-3">
      {/* Search + Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search leads..."
            value={filters.search ?? ""}
            onChange={(e) => update("search", e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
            showAdvanced
              ? "bg-blue-600/20 border-blue-600/40 text-blue-400"
              : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"
          }`}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          )}
        </button>
        {hasFilters && (
          <button
            onClick={clear}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-gray-200 bg-gray-900 transition-colors"
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-900/60 rounded-xl border border-gray-800">
          <select
            value={filters.platform ?? ""}
            onChange={(e) => update("platform", e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-600"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Industry..."
            value={filters.industry ?? ""}
            onChange={(e) => update("industry", e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
          />

          <select
            value={filters.urgency ?? ""}
            onChange={(e) => update("urgency", e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-600"
          >
            {URGENCY_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>

          <select
            value={filters.projectSize ?? ""}
            onChange={(e) => update("projectSize", e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-600"
          >
            {PROJECT_SIZE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">Min Intent</label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.minBuyerIntent ?? ""}
              onChange={(e) => update("minBuyerIntent", e.target.value)}
              className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">Min Fit</label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.minDelfinFit ?? ""}
              onChange={(e) => update("minDelfinFit", e.target.value)}
              className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-600"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.customSolutionNeeded === "true"}
              onChange={(e) => update("customSolutionNeeded", e.target.checked ? "true" : "")}
              className="w-4 h-4 rounded bg-gray-800 border-gray-600 accent-blue-500"
            />
            Custom Solution Only
          </label>

          <div className="flex gap-2">
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => update("dateFrom", e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-400 focus:outline-none focus:border-blue-600"
            />
            <input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => update("dateTo", e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-400 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      )}
    </div>
  );
}
