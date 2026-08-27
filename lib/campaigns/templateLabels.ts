export const TEMPLATE_LABELS: Record<string, string> = {
  PredictionLogicV2: "Prediction",
  VotingLogicV2: "Vote",
  SurveyLogic: "Survey",
  QuizLogic: "Quiz",
  RaffleLogic: "Raffle",
  BountyLogic: "Bounty",
  FanPassLogic: "Fan Pass",
  PointsPoolLogic: "Points Pool",
  TournamentLogic: "Tournament",
  AuctionLogic: "Auction",
};

export const TEMPLATE_FILTERS = [
  { key: "PredictionLogicV2", label: "Prediction" },
  { key: "VotingLogicV2", label: "Vote" },
  { key: "SurveyLogic", label: "Survey" },
  { key: "QuizLogic", label: "Quiz" },
  { key: "RaffleLogic", label: "Raffle" },
  { key: "BountyLogic", label: "Bounty" },
  { key: "FanPassLogic", label: "Fan Pass" },
  { key: "PointsPoolLogic", label: "Points Pool" },
  { key: "TournamentLogic", label: "Tournament" },
  { key: "AuctionLogic", label: "Auction" },
] as const;

export function getTemplateLabel(template?: string): string {
  if (!template) return "Campaign";
  return TEMPLATE_LABELS[template] ?? template.replace(/LogicV2?|Logic/g, "");
}

export function isPredictionTemplate(template?: string): boolean {
  return template === "PredictionLogicV2" || template === "QuizLogic" || template === "PointsPoolLogic" || template === "TournamentLogic";
}

export function isVotingTemplate(template?: string): boolean {
  return template === "VotingLogicV2";
}

export function isSurveyTemplate(template?: string): boolean {
  return template === "SurveyLogic";
}

export function isEntryTemplate(template?: string): boolean {
  return template === "RaffleLogic" || template === "BountyLogic" || template === "FanPassLogic" || template === "AuctionLogic";
}

export function getParticipationLabel(template?: string, count?: bigint | number): string {
  const numericCount = typeof count === "bigint" ? Number(count) : count;
  const plural = numericCount === 1 ? "" : "s";

  if (template === "PredictionLogicV2") return `prediction${plural}`;
  if (template === "QuizLogic") return `answer${plural}`;
  if (template === "PointsPoolLogic") return `weighted prediction${plural}`;
  if (template === "TournamentLogic") return `bracket prediction${plural}`;
  if (template === "SurveyLogic") return `response${plural}`;
  if (template === "RaffleLogic") return `entry${plural}`;
  if (template === "BountyLogic") return `registration${plural}`;
  if (template === "FanPassLogic") return `claim${plural}`;
  if (template === "AuctionLogic") return `bidder${plural}`;
  return `vote${plural}`;
}

export function getParticipationChartTitle(template?: string): string {
  if (template === "PredictionLogicV2") return "Prediction Split";
  if (template === "QuizLogic") return "Answer Split";
  if (template === "PointsPoolLogic") return "Weighted Consensus";
  if (template === "TournamentLogic") return "Round Prediction Split";
  if (template === "SurveyLogic") return "Response Split";
  if (template === "RaffleLogic") return "Raffle Entries";
  if (template === "BountyLogic") return "Challenge Registrations";
  if (template === "FanPassLogic") return "Pass Claims by Tier";
  if (template === "AuctionLogic") return "Bid Activity";
  return "Vote Share";
}

export function getNoParticipationText(template?: string): string {
  if (template === "PredictionLogicV2") return "No predictions yet";
  if (template === "QuizLogic") return "No answers yet";
  if (template === "PointsPoolLogic") return "No weighted predictions yet";
  if (template === "TournamentLogic") return "No round predictions yet";
  if (template === "SurveyLogic") return "No responses yet";
  if (template === "RaffleLogic") return "No entries yet";
  if (template === "BountyLogic") return "No registrations yet";
  if (template === "FanPassLogic") return "No passes claimed yet";
  if (template === "AuctionLogic") return "No bids yet";
  return "No votes yet";
}

export function getActionVerb(template?: string): string {
  if (template === "PredictionLogicV2") return "Predict";
  if (template === "QuizLogic") return "Answer";
  if (template === "PointsPoolLogic") return "Stake reputation";
  if (template === "TournamentLogic") return "Predict round";
  if (template === "SurveyLogic") return "Choose";
  if (template === "RaffleLogic") return "Enter";
  if (template === "BountyLogic") return "Register";
  if (template === "FanPassLogic") return "Claim";
  if (template === "AuctionLogic") return "Bid";
  return "Vote";
}

export function getOutcomeLabel(template?: string): string {
  if (template === "QuizLogic") return "Correct answer";
  if (template === "RaffleLogic") return "Winner";
  if (template === "BountyLogic") return "Selected winner";
  if (template === "FanPassLogic") return "Pass status";
  if (template === "AuctionLogic") return "Winning bid";
  if (isPredictionTemplate(template)) return "Outcome";
  return "Result";
}

export function getWinnerBadgeLabel(template?: string): string {
  if (template === "QuizLogic") return "Correct Answer";
  if (template === "RaffleLogic") return "Winner";
  if (template === "BountyLogic") return "Winner";
  if (template === "AuctionLogic") return "Winner";
  if (isPredictionTemplate(template)) return "Outcome";
  return "Winner";
}
