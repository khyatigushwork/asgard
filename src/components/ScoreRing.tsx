"use client";
import { getScoreColor, getScoreLabel } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  label: string;
  size?: "sm" | "md" | "lg";
}

export function ScoreRing({ score, label, size = "md" }: ScoreRingProps) {
  const radius = size === "lg" ? 38 : size === "md" ? 28 : 20;
  const strokeWidth = size === "lg" ? 5 : size === "md" ? 4 : 3;
  const svgSize = radius * 2 + strokeWidth * 2 + 4;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);

  const strokeColor =
    score >= 90
      ? "#34d399"
      : score >= 75
      ? "#4ade80"
      : score >= 50
      ? "#fbbf24"
      : score >= 25
      ? "#fb923c"
      : "#f87171";

  const fontSize = size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs";
  const labelSize = size === "lg" ? "text-xs" : "text-[10px]";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${fontSize} ${color}`}>{Math.round(score)}</span>
        </div>
      </div>
      <span className={`${labelSize} text-gray-400 font-medium text-center`}>{label}</span>
    </div>
  );
}
