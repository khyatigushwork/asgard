"use client";
import { useEffect, useState } from "react";
import { Settings, Save, Loader2 } from "lucide-react";

interface Threshold {
  id: string;
  minBuyerIntentScore: number;
  minDelfinFitScore: number;
  minConfidenceScore: number;
}

export default function SettingsPage() {
  const [threshold, setThreshold] = useState<Threshold | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/thresholds")
      .then((r) => r.json())
      .then((data) => { setThreshold(data); setLoading(false); });
  }, []);

  const save = async () => {
    if (!threshold) return;
    setSaving(true);
    await fetch("/api/thresholds", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minBuyerIntentScore: threshold.minBuyerIntentScore,
        minDelfinFitScore: threshold.minDelfinFitScore,
        minConfidenceScore: threshold.minConfidenceScore,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (key: keyof Threshold, value: number) => {
    if (!threshold) return;
    setThreshold({ ...threshold, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-gray-400" />
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>

      {/* Qualification Thresholds */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold text-white mb-1">Qualification Thresholds</h2>
        <p className="text-sm text-gray-500 mb-5">
          Leads are qualified when all scores meet or exceed these thresholds.
        </p>

        <div className="space-y-5">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-300">Min Buyer Intent Score</label>
              <span className="text-sm font-bold text-blue-400">{threshold?.minBuyerIntentScore ?? 70}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={threshold?.minBuyerIntentScore ?? 70}
              onChange={(e) => update("minBuyerIntentScore", Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-300">Min Delfin Fit Score</label>
              <span className="text-sm font-bold text-purple-400">{threshold?.minDelfinFitScore ?? 70}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={threshold?.minDelfinFitScore ?? 70}
              onChange={(e) => update("minDelfinFitScore", Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-300">Min Confidence Score</label>
              <span className="text-sm font-bold text-emerald-400">{threshold?.minConfidenceScore ?? 70}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={threshold?.minConfidenceScore ?? 70}
              onChange={(e) => update("minConfidenceScore", Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className={`mt-5 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-emerald-600/20 border border-emerald-600/40 text-emerald-400"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          } disabled:opacity-50`}
        >
          {saving ? (
            <><Loader2 size={14} className="animate-spin" /> Saving...</>
          ) : saved ? (
            "✓ Saved!"
          ) : (
            <><Save size={14} /> Save Thresholds</>
          )}
        </button>
      </div>

      {/* Environment variables guide */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold text-white mb-3">Environment Configuration</h2>
        <div className="space-y-2 font-mono text-xs">
          {[
            ["DATABASE_URL", "postgresql://user:password@localhost:5432/delfin_buyers"],
            ["APIFY_API_TOKEN", "apify_api_xxxxxxx"],
            ["ANTHROPIC_API_KEY", "sk-ant-xxxxxxx"],
            ["CRAWL_SCHEDULE", "0 */6 * * * (default: every 6h)"],
            ["QUALIFY_SCHEDULE", "*/30 * * * * (default: every 30m)"],
          ].map(([key, val]) => (
            <div key={key} className="flex gap-3">
              <span className="text-blue-400 min-w-[200px]">{key}</span>
              <span className="text-gray-500">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Model */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold text-white mb-1">AI Model</h2>
        <p className="text-sm text-gray-500 mb-3">Current qualification model</p>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-gray-300 font-mono">claude-sonnet-4-6</span>
          <span className="text-xs text-gray-600">(Anthropic)</span>
        </div>
      </div>
    </div>
  );
}
