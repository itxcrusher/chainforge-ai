// Demo league team theme map. Fictional teams; any resemblance to a real league is not intended.
// Values are stable across the UI and test fixtures.

export const DEMO_TEAMS = {
  "Northern Falcons": {
    primary: "#D71920",
    secondary: "#1D1D1D",
    accent: "#F5C542",
    tag: "NF",
  },
  "Desert Sultans": {
    primary: "#7B2D8B",
    secondary: "#FFD700",
    accent: "#FFFFFF",
    tag: "DS",
  },
  "Riverside Rangers": {
    primary: "#005EB8",
    secondary: "#FFD700",
    accent: "#FFFFFF",
    tag: "RR",
  },
  "Coastal Kings": {
    primary: "#00A651",
    secondary: "#FFFFFF",
    accent: "#005EB8",
    tag: "CK",
  },
  "Highland Warriors": {
    primary: "#F7941D",
    secondary: "#000000",
    accent: "#FFFFFF",
    tag: "HW",
  },
  "Summit Gladiators": {
    primary: "#1A1A1A",
    secondary: "#C41230",
    accent: "#FFD700",
    tag: "SG",
  },
} as const;

export type PSLTeamName = keyof typeof DEMO_TEAMS;
export type PSLTeamTheme = (typeof DEMO_TEAMS)[PSLTeamName];

export function getTeamTheme(name: string): PSLTeamTheme | null {
  return DEMO_TEAMS[name as PSLTeamName] ?? null;
}
