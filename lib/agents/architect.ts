import OpenAI from "openai";

export interface ArchitectOutput {
  useCase: string;
  templateSelected: string;
  campaignTitle: string;
  description: string;
  options: string[];
  deadlineStrategy: string;
  reasoning: string;
  confidenceScore: number;
  audienceFit: string;
  lifecycleStrategy: string;
  riskNotes: string[];
  suggestions: string[];
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoTags: string[];
  };
  deploymentNotes: string[];
}

const SYSTEM_PROMPT = `You are the Architect Agent for ChainForge AI.

Your task is to convert a plain-language builder request into a structured on-chain app plan for WireFluid.

Supported use cases:
- sports_prediction
- fan_voting
- event_engagement
- quiz_campaign
- raffle_campaign
- bounty_campaign
- fan_pass_campaign
- points_pool_campaign
- tournament_campaign
- auction_campaign

Supported templates and when to use them:
- PredictionLogicV2: sports outcomes, match results, binary or multi-option predictions with a deadline and on-chain result reveal. Use for: "who will win", "will X happen", any time-bounded outcome prediction.
- VotingLogicV2: community choices, rankings, preferences, fan polls. Use for: "best player", "favorite team", "rank the options", creator-controlled close.
- SurveyLogic: open feedback, sentiment collection, audience opinions. Use for: "how do you feel about", "what was the best moment", post-event feedback.
- QuizLogic: trivia and knowledge tests with scored answers. Creator reveals the correct answer after deadline. Use for: "cricket trivia", "test your knowledge", "quiz about the demo league facts", any question with a single correct answer.
- RaffleLogic: prize draws and giveaways where fans enter and one winner is selected on-chain. Use for: "win a prize", "giveaway", "lucky draw", "enter to win", any random winner selection.
- BountyLogic: creator-posted challenges where fans register participation and the creator manually picks winner(s) on-chain. Use for: "best fan photo", "most creative submission", "first correct answer submitted", any creator-judged competition.
- FanPassLogic: tiered soulbound access passes with supply caps. Fans claim a tier gaslessly. Use for: "fan membership", "event access", "VIP tier", "exclusive pass", "credential for fans", any access or credentialing system.
- PointsPoolLogic: reputation-weighted prediction pools where fans stake their existing reputation score on an outcome. No real money. Use for: "high-stakes prediction", "put your reputation on it", "weighted market", any prediction with reputation consequences.
- TournamentLogic: multi-round bracket predictions with cumulative on-chain scoring across rounds. Use for: "predict the whole season", "tournament bracket", "multi-match prediction", any multi-round competition where scores accumulate.
- AuctionLogic: fan privilege auctions where fans record bid intents on-chain (no real token custody) and the creator selects the winner. Use for: "bid on exclusive access", "fan privilege auction", "highest bidder wins", "exclusive fan moment".

Template selection rules:
- sports outcome, match winner, binary result with deadline → PredictionLogicV2
- community vote, preference, ranking → VotingLogicV2
- survey, sentiment, feedback, opinion → SurveyLogic
- trivia, quiz, knowledge test, single correct answer → QuizLogic
- giveaway, raffle, prize draw, lucky draw, enter to win → RaffleLogic
- challenge, bounty, submission contest, creator picks winner → BountyLogic
- fan pass, membership, event access, VIP tier, credential → FanPassLogic
- reputation-weighted prediction, put reputation on it → PointsPoolLogic
- full season bracket, multi-round, tournament scoring → TournamentLogic
- bid, auction, exclusive privilege, highest bidder → AuctionLogic

Return strict JSON only. Do not return markdown.

If the request is genuinely outside all supported templates (e.g. a lending protocol, DEX, stablecoin, bridge, or DAO treasury), return valid JSON with useCase set to "unsupported" and templateSelected set to "SurveyLogic".

Expected shape:
{
  "useCase": "sports_prediction",
  "templateSelected": "PredictionLogicV2",
  "campaignTitle": "the demo league Final: Northern Falcons vs Desert Sultans",
  "description": "Gas-sponsored prediction campaign on WireFluid.",
  "options": ["Northern Falcons", "Desert Sultans"],
  "deadlineStrategy": "match_end_plus_30m",
  "reasoning": "The user asked for a match winner prediction with a specific deadline. PredictionLogicV2 is the correct template because it supports binary outcomes, deadline enforcement, and on-chain result reveal by the creator.",
  "confidenceScore": 95,
  "audienceFit": "the demo league fans who want to predict match outcomes and build on-chain reputation through correct predictions.",
  "lifecycleStrategy": "Campaign opens immediately. Fans predict before the match ends. Creator closes after the match result is confirmed and reveals the winning team on-chain.",
  "riskNotes": [
    "Deadline must be set to after the match ends or fans may be locked out early.",
    "Creator must remember to close and reveal manually after the result is known."
  ],
  "suggestions": [
    "Consider adding a third option for 'No result / tie' if the match format allows draws.",
    "Set the deadline to 30 minutes after the scheduled match end to account for overruns."
  ],
  "theme": {
    "primaryColor": "#D71920",
    "secondaryColor": "#1D1D1D",
    "accentColor": "#F5C542",
    "logoTags": ["NF", "DS"]
  },
  "deploymentNotes": [
    "Use clone-based deployment",
    "Enable gas-sponsored user flow",
    "Serve reads through cache-first API"
  ]
}`;

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

function buildUnsupportedOutput(prompt: string): ArchitectOutput {
  return {
    useCase: "unsupported",
    templateSelected: "SurveyLogic",
    campaignTitle: "Unsupported request",
    description: `This request is outside the currently supported app categories: ${prompt.slice(0, 140)}`,
    options: ["Option A", "Option B"],
    deadlineStrategy: "creator_controlled_close",
    reasoning: "The prompt does not match any of the 10 supported app templates. The platform currently supports: predictions, votes, surveys, quizzes, raffles, bounties, fan passes, points pools, tournament brackets, and fan privilege auctions.",
    confidenceScore: 0,
    audienceFit: "Not applicable for unsupported request.",
    lifecycleStrategy: "Not applicable.",
    riskNotes: ["This request type is not supported by the current template set."],
    suggestions: ["Try describing a fan engagement experience: a prediction, quiz, raffle, fan pass, or auction for your community."],
    theme: {
      primaryColor: "#6366F1",
      secondaryColor: "#0F172A",
      accentColor: "#22C55E",
      logoTags: [],
    },
    deploymentNotes: ["Unsupported request"],
  };
}

function isClearlyUnsupportedPrompt(prompt: string): boolean {
  const text = prompt.trim().toLowerCase();
  if (!text) return false;

  const unsupportedSignals = [
    "lending protocol",
    "liquidation",
    "amm",
    "dex",
    "decentralized exchange",
    "yield farming",
    "yield vault",
    "perpetual",
    "orderbook",
    "nft marketplace",
    "bridge",
    "stablecoin",
    "governance token",
    "treasury management",
    "insurance protocol",
  ];

  const supportedSignals = [
    "prediction",
    "predict",
    "vote",
    "voting",
    "survey",
    "sentiment",
    "feedback",
    "fan",
    "poll",
    "campaign",
    "engagement",
    "quiz",
    "trivia",
    "knowledge",
    "raffle",
    "giveaway",
    "lucky draw",
    "prize",
    "bounty",
    "challenge",
    "submission",
    "contest",
    "pass",
    "ticket",
    "access",
    "membership",
    "credential",
    "reputation",
    "tournament",
    "bracket",
    "season",
    "auction",
    "bid",
    "privilege",
    "exclusive",
    "league",
    "cricket",
    "match",
    "player",
  ];

  const hasUnsupportedSignal = unsupportedSignals.some((signal) => text.includes(signal));
  const hasSupportedSignal = supportedSignals.some((signal) => text.includes(signal));

  return hasUnsupportedSignal && !hasSupportedSignal;
}

const USE_CASE_ALIASES: Record<string, string> = {
  "sports prediction": "sports_prediction",
  "fan voting": "fan_voting",
  "event engagement": "event_engagement",
  "quiz": "quiz_campaign",
  "quiz campaign": "quiz_campaign",
  "trivia": "quiz_campaign",
  "raffle": "raffle_campaign",
  "raffle campaign": "raffle_campaign",
  "giveaway": "raffle_campaign",
  "prize draw": "raffle_campaign",
  "bounty": "bounty_campaign",
  "bounty campaign": "bounty_campaign",
  "challenge": "bounty_campaign",
  "fan pass": "fan_pass_campaign",
  "fan pass campaign": "fan_pass_campaign",
  "access pass": "fan_pass_campaign",
  "points pool": "points_pool_campaign",
  "points pool campaign": "points_pool_campaign",
  "reputation pool": "points_pool_campaign",
  "tournament": "tournament_campaign",
  "tournament campaign": "tournament_campaign",
  "bracket": "tournament_campaign",
  "auction": "auction_campaign",
  "auction campaign": "auction_campaign",
  "bid": "auction_campaign",
  "survey": "event_engagement",
  "sentiment": "event_engagement",
  "feedback": "event_engagement",
};

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

const SUPPORTED_TEMPLATES = Object.keys(TEMPLATE_USE_CASE);

function inferTemplateFromPrompt(prompt: string): string | null {
  const text = prompt.toLowerCase();
  if (/\b(auction|bid|bidding|highest bidder|pledge)\b/.test(text)) return "AuctionLogic";
  if (/\b(tournament|bracket|playoffs|multi-round|rounds:)\b/.test(text)) return "TournamentLogic";
  if (/\b(points pool|reputation weight|reputation-weighted|stake reputation|weighted prediction)\b/.test(text)) return "PointsPoolLogic";
  if (/\b(fan pass|access pass|vip|tier|tiers:|membership|credential)\b/.test(text)) return "FanPassLogic";
  if (/\b(bounty|challenge|creator will pick|pick the best|best fan|submission contest|chant)\b/.test(text)) return "BountyLogic";
  if (/\b(raffle|giveaway|lucky draw|enter once|win a|prize:)\b/.test(text)) return "RaffleLogic";
  if (/\b(quiz|trivia|correct answer|who won|knowledge)\b/.test(text)) return "QuizLogic";
  if (/\b(survey|feedback|sentiment|best moment|what was the best|how do fans feel)\b/.test(text)) return "SurveyLogic";
  if (/\b(vote|voting|favorite|favourite|player of the season|rank)\b/.test(text)) return "VotingLogicV2";
  if (/\b(predict|prediction|who will win|winner|mvp|outcome)\b/.test(text)) return "PredictionLogicV2";
  return null;
}

function extractListAfterLabel(prompt: string, labels: string[]): string[] {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*:\\s*([^\\n.]+)`, "i");
    const match = prompt.match(pattern);
    if (!match?.[1]) continue;
    return match[1]
      .split(/,|;|\|/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.replace(/\s+with\s+\d+\s+supply$/i, "").trim());
  }
  return [];
}

function defaultOptionsForTemplate(templateSelected: string, prompt: string): string[] {
  const explicitOptions = extractListAfterLabel(prompt, ["Options", "Tiers", "Rounds"]);
  if (explicitOptions.length >= 2) return explicitOptions;

  switch (templateSelected) {
    case "RaffleLogic":
      return ["Enter raffle", "Do not enter"];
    case "BountyLogic":
      return ["Register for challenge", "Skip challenge"];
    case "FanPassLogic":
      return ["General Fan Pass", "Super Fan Pass", "VIP Pass"];
    case "TournamentLogic":
      return ["Qualifier", "Eliminator", "Final"];
    case "AuctionLogic":
      return ["Standard pledge", "Premium pledge", "VIP pledge"];
    case "PointsPoolLogic":
      return ["Option 1", "Option 2"];
    case "QuizLogic":
      return ["Answer A", "Answer B"];
    default:
      return ["Option A", "Option B"];
  }
}

function normalizeUseCase(useCase: string, templateSelected: string): string {
  const normalized = useCase.trim().toLowerCase();
  if (normalized === "unsupported") return "unsupported";
  if (SUPPORTED_USE_CASES.includes(normalized)) return normalized;
  if (USE_CASE_ALIASES[normalized]) return USE_CASE_ALIASES[normalized];

  // Template-based fallback
  const templateFallbacks: Record<string, string> = {
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
  return templateFallbacks[templateSelected] ?? "event_engagement";
}

function coerceArchitectOutput(obj: unknown, prompt: string): ArchitectOutput | null {
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;

  const inferredTemplate = inferTemplateFromPrompt(prompt);
  const rawTemplate = typeof o.templateSelected === "string" ? o.templateSelected : "SurveyLogic";
  const templateSelected = inferredTemplate ?? (SUPPORTED_TEMPLATES.includes(rawTemplate) ? rawTemplate : "SurveyLogic");
  const useCaseRaw = inferredTemplate ? TEMPLATE_USE_CASE[templateSelected] : (typeof o.useCase === "string" ? o.useCase : "event_engagement");
  const rawOptions = Array.isArray(o.options) ? o.options.filter((v): v is string => typeof v === "string") : [];
  const options = rawOptions.length >= 2 ? rawOptions : defaultOptionsForTemplate(templateSelected, prompt);
  const deploymentNotes = Array.isArray(o.deploymentNotes)
    ? o.deploymentNotes.filter((v): v is string => typeof v === "string")
    : [];
  const riskNotes = Array.isArray(o.riskNotes)
    ? o.riskNotes.filter((v): v is string => typeof v === "string")
    : [];
  const suggestions = Array.isArray(o.suggestions)
    ? o.suggestions.filter((v): v is string => typeof v === "string")
    : [];
  const themeObj = typeof o.theme === "object" && o.theme !== null ? o.theme as Record<string, unknown> : {};

  const normalizedUseCase = normalizeUseCase(useCaseRaw, templateSelected);
  if (normalizedUseCase === "unsupported") {
    return {
      useCase: "unsupported",
      templateSelected,
      campaignTitle: typeof o.campaignTitle === "string" ? o.campaignTitle : "Unsupported request",
      description: typeof o.description === "string" ? o.description : "This request is outside the currently supported app categories.",
      options: options.length >= 2 ? options : ["Option A", "Option B"],
      deadlineStrategy: typeof o.deadlineStrategy === "string" ? o.deadlineStrategy : "creator_controlled_close",
      reasoning: typeof o.reasoning === "string" ? o.reasoning : "This prompt does not match any supported template.",
      confidenceScore: 0,
      audienceFit: typeof o.audienceFit === "string" ? o.audienceFit : "Not applicable.",
      lifecycleStrategy: typeof o.lifecycleStrategy === "string" ? o.lifecycleStrategy : "Not applicable.",
      riskNotes,
      suggestions: suggestions.length > 0 ? suggestions : ["Try a prediction, quiz, raffle, fan pass, or auction for your community."],
      theme: {
        primaryColor: typeof themeObj.primaryColor === "string" ? themeObj.primaryColor : "#6366F1",
        secondaryColor: typeof themeObj.secondaryColor === "string" ? themeObj.secondaryColor : "#0F172A",
        accentColor: typeof themeObj.accentColor === "string" ? themeObj.accentColor : "#22C55E",
        logoTags: Array.isArray(themeObj.logoTags)
          ? themeObj.logoTags.filter((v): v is string => typeof v === "string")
          : [],
      },
      deploymentNotes: deploymentNotes.length > 0 ? deploymentNotes : ["Unsupported request"],
    };
  }

  if (typeof o.campaignTitle !== "string") {
    return null;
  }

  const description = typeof o.description === "string"
    ? o.description
    : `A ${templateSelected} app generated from the creator prompt.`;

  return {
    useCase: normalizedUseCase,
    templateSelected,
    campaignTitle: o.campaignTitle,
    description,
    options,
    deadlineStrategy: typeof o.deadlineStrategy === "string"
      ? o.deadlineStrategy
      : templateSelected === "SurveyLogic" || templateSelected === "BountyLogic"
      ? "creator_controlled_close"
      : "48h",
    reasoning: typeof o.reasoning === "string" ? o.reasoning : `${templateSelected} was selected based on the prompt context.`,
    confidenceScore: typeof o.confidenceScore === "number"
      ? Math.max(0, Math.min(100, Math.round(o.confidenceScore)))
      : 80,
    audienceFit: typeof o.audienceFit === "string" ? o.audienceFit : "Fans and community members.",
    lifecycleStrategy: typeof o.lifecycleStrategy === "string" ? o.lifecycleStrategy : "Creator manages open, close, and reveal.",
    riskNotes,
    suggestions,
    theme: {
      primaryColor: typeof themeObj.primaryColor === "string" ? themeObj.primaryColor : "#6366F1",
      secondaryColor: typeof themeObj.secondaryColor === "string" ? themeObj.secondaryColor : "#0F172A",
      accentColor: typeof themeObj.accentColor === "string" ? themeObj.accentColor : "#22C55E",
      logoTags: Array.isArray(themeObj.logoTags)
        ? themeObj.logoTags.filter((v): v is string => typeof v === "string")
        : [],
    },
    deploymentNotes: deploymentNotes.length > 0
      ? deploymentNotes
      : [
          "Use clone-based deployment",
          "Enable gas-sponsored user flow",
          "Serve reads through cache-first API",
        ],
  };
}

export async function runArchitect(
  client: OpenAI,
  prompt: string
): Promise<ArchitectOutput> {
  if (isClearlyUnsupportedPrompt(prompt)) {
    return buildUnsupportedOutput(prompt);
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Architect returned empty response");

  const parsed: unknown = JSON.parse(content);
  const normalized = coerceArchitectOutput(parsed, prompt);
  if (!normalized) {
    throw new Error("Architect output failed schema validation");
  }

  return normalized;
}
