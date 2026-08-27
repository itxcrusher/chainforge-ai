export function containsBracketPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  return /\[[^\]]+\]/.test(value);
}

export function isPresentationReadyCampaign(title: string | undefined, options: string[] | undefined): boolean {
  if (!title || !Array.isArray(options) || options.length < 2) return false;
  if (containsBracketPlaceholder(title)) return false;
  return options.every((option) => typeof option === "string" && option.trim().length > 0 && !containsBracketPlaceholder(option));
}
