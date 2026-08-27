"use client";

import {
  getNoParticipationText,
  getParticipationChartTitle,
  getParticipationLabel,
} from "@/lib/campaigns/templateLabels";

const COLORS = ["#6366F1", "#8B5CF6", "#06B6D4", "#10B981"];

const R = 40;
const CX = 60;
const CY = 60;
const STROKE_WIDTH = 16;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface Segment {
  option: string;
  count: bigint;
  pct: number;
  arcLength: number;
  dashOffset: number;
  color: string;
}

function buildSegments(
  options: string[],
  voteCounts: bigint[],
  total: bigint
): Segment[] {
  let cumulative = 0;
  return options.map((option, i) => {
    const count = voteCounts[i] ?? 0n;
    const pct = total > 0n ? Number((count * 100n) / total) : 0;
    const arcLength = (pct / 100) * CIRCUMFERENCE;
    const dashOffset = CIRCUMFERENCE - cumulative;
    cumulative += arcLength;
    return {
      option,
      count,
      pct,
      arcLength,
      dashOffset,
      color: COLORS[i % COLORS.length],
    };
  });
}

interface VoteShareChartProps {
  options: string[];
  voteCounts: bigint[];
  template?: string;
}

export default function VoteShareChart({ options, voteCounts, template }: VoteShareChartProps) {
  const total = voteCounts.reduce((acc, v) => acc + v, 0n);
  const segments = buildSegments(options, voteCounts, total);

  return (
    <div className="bg-[#1E293B] border border-slate-700 rounded-xl p-6 mb-6">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">
        {getParticipationChartTitle(template)}
      </h3>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* SVG donut chart */}
        <div className="shrink-0">
          <svg
            viewBox="0 0 120 120"
            width="140"
            height="140"
            className="-rotate-90"
          >
            {/* Background ring */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="#1e293b"
              strokeWidth={STROKE_WIDTH + 2}
            />
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="#334155"
              strokeWidth={STROKE_WIDTH}
            />

            {total === 0n ? null : segments.map((seg) => (
              <circle
                key={seg.option}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={`${seg.arcLength} ${CIRCUMFERENCE}`}
                strokeDashoffset={seg.dashOffset}
                strokeLinecap="butt"
              />
            ))}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 flex-1 w-full">
          {segments.map((seg) => (
            <div key={seg.option} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-sm text-slate-300 truncate">{seg.option}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-sm">
                <span className="text-slate-400">{seg.count.toString()} {getParticipationLabel(template, seg.count)}</span>
                <span className="font-semibold text-white w-10 text-right">
                  {seg.pct}%
                </span>
              </div>
            </div>
          ))}

          {total === 0n && (
            <p className="text-xs text-slate-500 mt-1">{getNoParticipationText(template)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
