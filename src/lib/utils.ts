import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
  return Math.round(score).toString();
}

export function getScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 25) return "text-orange-400";
  return "text-red-400";
}

export function getScoreBg(score: number): string {
  if (score >= 90) return "bg-emerald-900/40 border-emerald-700/50";
  if (score >= 75) return "bg-green-900/40 border-green-700/50";
  if (score >= 50) return "bg-yellow-900/40 border-yellow-700/50";
  if (score >= 25) return "bg-orange-900/40 border-orange-700/50";
  return "bg-red-900/40 border-red-700/50";
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Active Procurement";
  if (score >= 75) return "Strong Signal";
  if (score >= 50) return "Potential Buyer";
  if (score >= 25) return "Weak Signal";
  return "No Intent";
}

export function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    REDDIT: "🔴",
    QUORA: "🟤",
    TWITTER: "🐦",
    LINKEDIN: "💼",
    INDUSTRY_FORUMS: "🏭",
    THOMASNET: "🔧",
    ENGINEERING_STACK: "⚙️",
    OTHER: "🌐",
  };
  return icons[platform] ?? "🌐";
}

export function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    REDDIT: "Reddit",
    QUORA: "Quora",
    TWITTER: "Twitter/X",
    LINKEDIN: "LinkedIn",
    INDUSTRY_FORUMS: "Industry Forums",
    THOMASNET: "ThomasNet",
    ENGINEERING_STACK: "Engineering Stack",
    OTHER: "Other",
  };
  return labels[platform] ?? platform;
}

export function getUrgencyColor(urgency: string): string {
  const colors: Record<string, string> = {
    IMMEDIATE: "text-red-400",
    SHORT_TERM: "text-orange-400",
    MEDIUM_TERM: "text-yellow-400",
    LONG_TERM: "text-blue-400",
    UNKNOWN: "text-gray-400",
  };
  return colors[urgency] ?? "text-gray-400";
}

export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}
