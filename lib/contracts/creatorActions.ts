export type CreatorAction = "close" | "reveal";

export function buildCreatorActionMessage(
  contractAddress: string,
  action: CreatorAction,
  winnerIndex?: number
) {
  const lines = [
    "ChainForge AI creator action authorization",
    `Contract: ${contractAddress.toLowerCase()}`,
    `Action: ${action}`,
  ];

  if (winnerIndex !== undefined) {
    lines.push(`WinnerIndex: ${winnerIndex}`);
  }

  lines.push("Purpose: authorize server-side lifecycle transaction on WireFluid");
  return lines.join("\n");
}
