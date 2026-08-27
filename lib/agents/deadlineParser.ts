/**
 * Converts an Architect deadlineStrategy string into a Unix timestamp (seconds).
 * Returns 0 for open/no-deadline strategies (VotingLogic only).
 * Defaults to 48h if the strategy is unrecognised.
 */
export function parseDeadlineStrategy(strategy: string): number {
  const now = Math.floor(Date.now() / 1000);
  const s = (strategy ?? "").toLowerCase().trim();

  if (!s) return now + 172800; // missing → 48h default

  if (s === "open" || s === "none" || s === "0") return 0; // open voting — no cutoff

  if (s.includes("match_end") || s.includes("plus_30m")) return now + 7200;  // 90min match + 30min buffer
  if (s.includes("kick_off") || s.includes("plus_90m")) return now + 5400;   // 90min from kick-off

  if (s === "24h") return now + 86400;
  if (s === "48h") return now + 172800;
  if (s === "7d")  return now + 604800;

  // Numeric patterns: "6h", "3d", etc.
  const hoursMatch = s.match(/^(\d+)h$/);
  if (hoursMatch) return now + parseInt(hoursMatch[1], 10) * 3600;

  const daysMatch = s.match(/^(\d+)d$/);
  if (daysMatch) return now + parseInt(daysMatch[1], 10) * 86400;

  return now + 172800; // unrecognised → 48h default
}
