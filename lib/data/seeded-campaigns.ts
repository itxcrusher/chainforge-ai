// Seeded demo scenarios — stable across all rehearsals, docs, deck, and proof.
// These values model the current public product: V2 lifecycle campaigns only.

export const SEEDED_SCENARIO_1 = {
  slug: "season-final-nf-vs-ds",
  title: "the demo league Final: Northern Falcons vs Desert Sultans",
  description: "Gas-sponsored match winner prediction campaign for the demo league fans on WireFluid.",
  useCase: "sports_prediction" as const,
  template: "PredictionLogicV2" as const,
  options: ["Northern Falcons", "Desert Sultans"],
  teamA: "Northern Falcons",
  teamB: "Desert Sultans",
};

export const SEEDED_SCENARIO_2 = {
  slug: "season-final-potm-vote",
  title: "the demo league Final: Player of the Match Vote",
  description: "Fan vote for Player of the Match — the demo league Final on WireFluid.",
  useCase: "fan_voting" as const,
  template: "VotingLogicV2" as const,
  options: ["Player A", "Player B", "Player C"],
};

export const SEEDED_SCENARIO_3 = {
  slug: "season-final-fan-pulse",
  title: "the demo league Final Fan Pulse",
  description: "Pre-match fan sentiment campaign for the the demo league Final on WireFluid.",
  useCase: "event_engagement" as const,
  template: "SurveyLogic" as const,
  options: [
    "Confident for Northern Falcons",
    "Confident for Desert Sultans",
    "Just here for the final",
  ],
};

export const FLAGSHIP_SCENARIO = SEEDED_SCENARIO_1;
