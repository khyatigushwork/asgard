"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Star, Zap, RefreshCw, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface Analytics {
  totalLeads: number;
  qualifiedLeads: number;
  avgBuyerIntent: number;
  avgDelfinFit: number;
  byPlatform: Record<string, number>;
  byIndustry: Record<string, number>;
  byUrgency: Record<string, number>;
  recentTrend: Array<{ date: string; count: number; qualified: number }>;
  pendingProcessing: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  REDDIT: "#ff4500",
  QUORA: "#b92b27",
  TWITTER: "#1da1f2",
  LINKEDIN: "#0077b5",
  INDUSTRY_FORUMS: "#8b5cf6",
  OTHER: "#6b7280",
};

const URGENCY_COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#6b7280"];

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  color = "blue",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "from-blue-600/20 to-blue-900/10 border-blue-700/30",
    green: "from-emerald-600/20 to-emerald-900/10 border-emerald-700/30",
    amber: "from-amber-600/20 to-amber-900/10 border-amber-700/30",
    purple: "from-purple-600/20 to-purple-900/10 border-purple-700/30",
  };
  const iconColors: Record<string, string> = {
    blue: "text-blue-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <Icon className={`w-6 h-6 ${iconColors[color]}`} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await window.fetch("/api/analytics");
      const data = await res.json();
      setAnalytics(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const platformData = analytics
    ? Object.entries(analytics.byPlatform).map(([name, value]) => ({ name, value }))
    : [];

  const industryData = analytics
    ? Object.entries(analytics.byIndustry)
        .slice(0, 8)
        .map(([name, value]) => ({ name: name.substring(0, 20), value }))
    : [];

  const urgencyData = analytics
    ? Object.entries(analytics.byUrgency).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Intelligence Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Industrial buyer discovery overview</p>
        </div>
        <div className="flex gap-2">
          {analytics?.pendingProcessing ? (
            <span className="px-3 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-400 text-xs">
              {analytics.pendingProcessing} posts pending analysis
            </span>
          ) : null}
          <button
            onClick={fetch}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <Link
            href="/crawl"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Zap size={14} /> New Crawl
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={analytics?.totalLeads ?? 0}
          icon={Users}
          sub="All discovered leads"
          color="blue"
        />
        <StatCard
          title="Qualified Leads"
          value={analytics?.qualifiedLeads ?? 0}
          icon={Star}
          sub="Intent ≥70 & Fit ≥70"
          color="green"
        />
        <StatCard
          title="Avg Buyer Intent"
          value={`${analytics?.avgBuyerIntent ?? 0}/100`}
          icon={TrendingUp}
          color="amber"
        />
        <StatCard
          title="Avg Delfin Fit"
          value={`${analytics?.avgDelfinFit ?? 0}/100`}
          icon={ArrowUpRight}
          color="purple"
        />
      </div>

      {/* Trend Chart */}
      {analytics?.recentTrend && analytics.recentTrend.length > 0 && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Lead Discovery Trend (14 days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analytics.recentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#9ca3af" }}
              />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="qualified" stroke="#10b981" strokeWidth={2} dot={false} name="Qualified" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* By Platform */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Leads by Platform</h2>
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={platformData} layout="vertical">
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                />
                <Bar dataKey="value" radius={4}>
                  {platformData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={PLATFORM_COLORS[entry.name] ?? "#6b7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No data yet</div>
          )}
        </div>

        {/* By Industry */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Top Industries</h2>
          {industryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={industryData} layout="vertical">
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 10 }} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No data yet</div>
          )}
        </div>

        {/* By Urgency */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Urgency Distribution</h2>
          {urgencyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={urgencyData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }) =>
                    `${name.substring(0,8)} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {urgencyData.map((_, i) => (
                    <Cell key={i} fill={URGENCY_COLORS[i % URGENCY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-3">
        <Link
          href="/leads?qualified=true"
          className="flex-1 flex items-center justify-between p-4 bg-gray-900/60 border border-gray-800 hover:border-emerald-700/50 rounded-xl transition-all group"
        >
          <div>
            <p className="font-medium text-white group-hover:text-emerald-400 transition-colors">View Qualified Leads</p>
            <p className="text-xs text-gray-500 mt-0.5">High intent + High Delfin fit</p>
          </div>
          <ArrowUpRight className="text-gray-600 group-hover:text-emerald-400 transition-colors" size={18} />
        </Link>
        <Link
          href="/raw-feed"
          className="flex-1 flex items-center justify-between p-4 bg-gray-900/60 border border-gray-800 hover:border-blue-700/50 rounded-xl transition-all group"
        >
          <div>
            <p className="font-medium text-white group-hover:text-blue-400 transition-colors">Browse Raw Feed</p>
            <p className="text-xs text-gray-500 mt-0.5">All collected posts</p>
          </div>
          <ArrowUpRight className="text-gray-600 group-hover:text-blue-400 transition-colors" size={18} />
        </Link>
      </div>
    </div>
  );
}
