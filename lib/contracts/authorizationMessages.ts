type DeployMessageInput = {
  creatorAddress: string;
  templateName: string;
  campaignTitle: string;
  options: string[];
  deadlineStrategy?: string;
  issuedAt: number;
};

export function buildDeployAuthorizationMessage(input: DeployMessageInput) {
  return [
    "ChainForge AI deploy authorization",
    `Creator: ${input.creatorAddress.toLowerCase()}`,
    `Template: ${input.templateName}`,
    `Title: ${input.campaignTitle}`,
    `Options: ${input.options.join(" | ")}`,
    `DeadlineStrategy: ${input.deadlineStrategy ?? "48h"}`,
    `IssuedAt: ${input.issuedAt}`,
    "Purpose: authorize server-side campaign deployment on WireFluid",
  ].join("\n");
}

type ParticipationMessageInput = {
  contractAddress: string;
  userAddress: string;
  optionIndex: number;
  issuedAt: number;
};

export function buildParticipationAuthorizationMessage(input: ParticipationMessageInput) {
  return [
    "ChainForge AI participation authorization",
    `Contract: ${input.contractAddress.toLowerCase()}`,
    `User: ${input.userAddress.toLowerCase()}`,
    `OptionIndex: ${input.optionIndex}`,
    `IssuedAt: ${input.issuedAt}`,
    "Purpose: authorize server-side gas-sponsored participation on WireFluid",
  ].join("\n");
}
