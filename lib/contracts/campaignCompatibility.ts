import { getPublicClient } from "@/lib/contracts/clients";

const RUNTIME_PREFIX = "363d3d373d3d3d363d73";
const IMPLEMENTATION_OFFSET = RUNTIME_PREFIX.length;
const IMPLEMENTATION_HEX_LENGTH = 40;

type Compatibility = {
  relayCompatible: boolean;
  compatibilityNote?: string;
  implementationAddress?: string;
};

const TEMPLATE_ENV: Record<string, string> = {
  PredictionLogicV2: "PREDICTION_V2_IMPLEMENTATION_ADDRESS",
  VotingLogicV2: "VOTING_V2_IMPLEMENTATION_ADDRESS",
  SurveyLogic: "SURVEY_IMPLEMENTATION_ADDRESS",
  QuizLogic: "QUIZ_IMPLEMENTATION_ADDRESS",
  RaffleLogic: "RAFFLE_IMPLEMENTATION_ADDRESS",
  BountyLogic: "BOUNTY_IMPLEMENTATION_ADDRESS",
  FanPassLogic: "FAN_PASS_IMPLEMENTATION_ADDRESS",
  PointsPoolLogic: "POINTS_POOL_IMPLEMENTATION_ADDRESS",
  TournamentLogic: "TOURNAMENT_IMPLEMENTATION_ADDRESS",
  AuctionLogic: "AUCTION_IMPLEMENTATION_ADDRESS",
};

function normalizeAddress(value: string | undefined) {
  return value ? value.toLowerCase() : undefined;
}

function getExpectedImplementation(template: string) {
  const envName = TEMPLATE_ENV[template];
  if (!envName) return undefined;
  return normalizeAddress(process.env[envName]);
}

function extractImplementationAddress(bytecode?: `0x${string}`) {
  if (!bytecode) return undefined;
  const hex = bytecode.slice(2).toLowerCase();
  const prefixIndex = hex.indexOf(RUNTIME_PREFIX);
  if (prefixIndex === -1) return undefined;
  const start = prefixIndex + IMPLEMENTATION_OFFSET;
  const raw = hex.slice(start, start + IMPLEMENTATION_HEX_LENGTH);
  if (raw.length !== IMPLEMENTATION_HEX_LENGTH) return undefined;
  return `0x${raw}`;
}

export async function getCampaignCompatibility(
  campaignAddress: `0x${string}`,
  template: string
): Promise<Compatibility> {
  if (template === "PredictionLogic" || template === "VotingLogic") {
    return {
      relayCompatible: false,
      compatibilityNote: "Legacy V1 campaign. Gas-sponsored participation is disabled for this template.",
    };
  }

  const expectedImplementation = getExpectedImplementation(template);
  if (!expectedImplementation) {
    return {
      relayCompatible: false,
      compatibilityNote: "Template implementation address is not configured for this environment.",
    };
  }

  const client = getPublicClient();
  const bytecode = await client.getBytecode({ address: campaignAddress });
  const implementationAddress = extractImplementationAddress(bytecode);

  if (!implementationAddress) {
    return {
      relayCompatible: false,
      compatibilityNote: "Could not determine campaign implementation.",
    };
  }

  const normalizedImplementation = implementationAddress.toLowerCase();
  if (normalizedImplementation !== expectedImplementation) {
    return {
      relayCompatible: false,
      implementationAddress,
      compatibilityNote: "Clone implementation does not match the configured current implementation. Viewable, but participation is disabled.",
    };
  }

  return {
    relayCompatible: true,
    implementationAddress,
  };
}
