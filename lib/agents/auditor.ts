import OpenAI from "openai";
import type { ArchitectOutput } from "./architect";

export interface AuditCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface AuditorOutput {
  status: "approved" | "rejected";
  checks: AuditCheck[];
  summary: string;
  reason?: string;
  suggestions: string[];
  warnings: string[];
}

const SUPPORTED_USE_CASES = [
  "sports_prediction",
  "fan_voting",
  "event_engagement",
  "quiz_campaign",
  "raffle_campaign",
  "bounty_campaign",
  "fan_pass_campaign",
  "points_pool_campaign",
  "tournament_campaign",
  "auction_campaign",
];

const SUPPORTED_TEMPLATES = [
  "PredictionLogicV2",
  "VotingLogicV2",
  "SurveyLogic",
  "QuizLogic",
  "RaffleLogic",
  "BountyLogic",
  "FanPassLogic",
  "PointsPoolLogic",
  "TournamentLogic",
  "AuctionLogic",
];

const TEMPLATE_USE_CASE: Record<string, string> = {
  PredictionLogicV2: "sports_prediction",
  VotingLogicV2: "fan_voting",
  SurveyLogic: "event_engagement",
  QuizLogic: "quiz_campaign",
  RaffleLogic: "raffle_campaign",
  BountyLogic: "bounty_campaign",
  FanPassLogic: "fan_pass_campaign",
  PointsPoolLogic: "points_pool_campaign",
  TournamentLogic: "tournament_campaign",
  AuctionLogic: "auction_campaign",
};

const PLACEHOLDER_RE = /\[[^\]]+\]|\b(option\s*[a-z])\b|\btbd\b|\bplaceholder\b/i;

function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER_RE.test(value.trim());
}

function pushSuggestion(suggestions: string[], value: string) {
  if (!suggestions.includes(value)) suggestions.push(value);
}

export async function runAuditor(
  _client: OpenAI,
  config: ArchitectOutput
): Promise<AuditorOutput> {
  const suggestions: string[] = [...(config.suggestions ?? [])];
  const warnings: string[] = [...(config.riskNotes ?? [])];
  const expectedUseCase = TEMPLATE_USE_CASE[config.templateSelected];

  const supportedUseCase =
    SUPPORTED_USE_CASES.includes(config.useCase) || Boolean(expectedUseCase);
  const validTemplate = SUPPORTED_TEMPLATES.includes(config.templateSelected);
  const titlePresent =
    typeof config.campaignTitle === "string" &&
    config.campaignTitle.trim().length > 0 &&
    !hasPlaceholder(config.campaignTitle);
  const minimumTwoOptions = Array.isArray(config.options) && config.options.length >= 2;
  const noPlaceholderOptions =
    Array.isArray(config.options) && config.options.every((option) => !hasPlaceholder(option));
  const deadlinePresent =
    typeof config.deadlineStrategy === "string" && config.deadlineStrategy.trim().length > 0;

  if (expectedUseCase && config.useCase !== expectedUseCase) {
    warnings.push(
      `${config.templateSelected} normally maps to ${expectedUseCase}; normalized planner output used ${config.useCase}. This is non-blocking because the template itself is supported.`
    );
  }

  if (config.templateSelected === "RaffleLogic") {
    pushSuggestion(suggestions, "Make the prize description specific so fans understand what they are entering to win.");
  }

  if (config.templateSelected === "FanPassLogic") {
    pushSuggestion(suggestions, "Use clear tier names and supply caps so scarcity is obvious before deployment.");
  }

  if (config.templateSelected === "TournamentLogic") {
    warnings.push(
      "Tournament deployment initializes the tournament shell. Round creation/finalization is an advanced creator action and may need additional UI during QA."
    );
  }

  if (config.templateSelected === "AuctionLogic") {
    warnings.push(
      "Auction bids are pledge commitments only; no token custody or real-money settlement is performed by this template."
    );
  }

  const checks: AuditCheck[] = [
    {
      name: "supported_use_case",
      passed: supportedUseCase,
      reason: supportedUseCase ? undefined : `useCase '${config.useCase}' is not supported`,
    },
    {
      name: "valid_template",
      passed: validTemplate,
      reason: validTemplate ? undefined : `${config.templateSelected} is not a registered planning template.`,
    },
    {
      name: "title_present",
      passed: titlePresent,
      reason: titlePresent ? undefined : "Title is empty or still contains bracketed placeholder text.",
    },
    {
      name: "minimum_two_options",
      passed: minimumTwoOptions,
      reason: minimumTwoOptions ? undefined : "At least two labels/options/tiers are required for deploy review.",
    },
    {
      name: "no_placeholder_options",
      passed: noPlaceholderOptions,
      reason: noPlaceholderOptions ? undefined : "Replace placeholder options like [option A], Option A, or TBD before deployment.",
    },
    {
      name: "deadline_present",
      passed: deadlinePresent,
      reason: deadlinePresent ? undefined : "Deadline strategy is missing.",
    },
  ];

  const failedChecks = checks.filter((check) => !check.passed);
  const approved = failedChecks.length === 0;

  return {
    status: approved ? "approved" : "rejected",
    checks,
    summary: approved
      ? "Configuration approved. This campaign is ready for deployment review."
      : "Configuration rejected. Fix the highlighted fields and re-plan before deploying.",
    reason: approved ? undefined : failedChecks.map((check) => check.reason).filter(Boolean).join(" "),
    suggestions,
    warnings,
  };
}
