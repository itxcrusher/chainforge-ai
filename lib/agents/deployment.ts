import type { ArchitectOutput } from "./architect";

export interface DeploymentPlan {
  template: string;
  deploymentSummary: string;
  initCalldataNote: string;
  proofItems: string[];
}

function getInitCalldataNote(template: string) {
  if (template === "SurveyLogic") {
    return "initialize(address owner, string title, string[] options) - calldata encoded server-side in /api/deploy using viem encodeFunctionData";
  }

  if (["PredictionLogicV2", "VotingLogicV2", "QuizLogic", "PointsPoolLogic"].includes(template)) {
    return "initialize(address owner, string title, string[] options, uint256 deadline) - calldata encoded server-side in /api/deploy";
  }

  if (["RaffleLogic", "BountyLogic", "AuctionLogic"].includes(template)) {
    return "initialize(address owner, string title, string description, uint256 deadline) - description derived from Architect output";
  }

  if (template === "FanPassLogic") {
    return "initialize(address owner, string title, string[] tierNames, uint256[] tierMaxSupplies) - tier names derived from options";
  }

  if (template === "TournamentLogic") {
    return "initialize(address owner, string title) - rounds are added by creator actions after deployment";
  }

  return "initialize(...) - calldata encoded server-side in /api/deploy using viem encodeFunctionData";
}

export function runDeploymentAgent(config: ArchitectOutput): DeploymentPlan {
  return {
    template: config.templateSelected,
    deploymentSummary: `Deploy ${config.templateSelected} clone via CampaignFactory on WireFluid (chainId 92533). Campaign: "${config.campaignTitle}". Options: ${config.options.join(", ")}.`,
    initCalldataNote: getInitCalldataNote(config.templateSelected),
    proofItems: [
      "Factory clone creation tx hash",
      "CampaignCreated event on WireFluid explorer",
      "Campaign address",
      "initialize() calldata visible in tx input data",
    ],
  };
}
