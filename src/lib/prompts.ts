import { clampText } from "@/lib/utils";

export function systemPreamble(): string {
  return [
    "You are a careful analyst assisting a licensing professional.",
    "You must follow instructions exactly.",
    "Never invent evidence. If a claim is not supported by a user-provided public URL or user-provided excerpt, label it as to_verify.",
    "Do NOT include personal contact details (no emails, phone numbers, names). Use only role/titles.",
    "All outputs MUST be valid JSON with no additional text.",
  ].join("\n");
}

export function candidateGenerationUserPrompt(input: {
  brandCategory?: string | null;
  productTypeSought?: string | null;
  priceRange?: string | null;
  distributionPreference?: string | null;
  geography?: string | null;
  positioningKeywords?: string | null;
  constraints?: string | null;
  excludeList?: string[];
}): string {
  const ex = input.excludeList && input.excludeList.length ? input.excludeList.join(", ") : "(none)";

  return [
    "Generate a list of candidate companies that could be strong licensee/manufacturer partners.",
    "Optimize for NON-OBVIOUS names (avoid giants / usual suspects) and specialty/boutique distribution alignment.",
    "Avoid mass market oriented companies unless you flag as a risk.",
    "Return 12-15 candidates.",
    "\nProject intake:",
    `- Brand category: ${input.brandCategory ?? "(missing)"}`,
    `- Product types sought: ${input.productTypeSought ?? "(missing)"}`,
    `- Price range: ${input.priceRange ?? "(missing)"}`,
    `- Distribution preference: ${input.distributionPreference ?? "(missing)"}`,
    `- Geography: ${input.geography ?? "(optional)"}`,
    `- Positioning keywords: ${input.positioningKeywords ?? "(optional)"}`,
    `- Constraints: ${input.constraints ?? "(optional)"}`,
    `- Exclude list (do not include these): ${ex}`,
    "\nOutput JSON schema:",
    "{ candidates: [{ name: string, website?: string|null, notes?: string|null, whyNonObvious?: string|null }, ...] }",
  ].join("\n");
}

export function scoreCandidateUserPrompt(input: {
  project: {
    brandCategory?: string | null;
    productTypeSought?: string | null;
    priceRange?: string | null;
    distributionPreference?: string | null;
    geography?: string | null;
    positioningKeywords?: string | null;
    constraints?: string | null;
  };
  candidate: {
    name: string;
    website?: string | null;
    notes?: string | null;
  };
  evidenceBullets: Array<{ text: string; url?: string | null }>;
}): string {
  const ev = input.evidenceBullets.length
    ? input.evidenceBullets
        .slice(0, 8)
        .map((b, i) => `  ${i + 1}. ${clampText(b.text, 240)}${b.url ? ` (source: ${b.url})` : ""}`)
        .join("\n")
    : "  (none)";

  return [
    "Score the candidate for licensing partner fit for this project.",
    "You MUST follow the scoring criteria and constraints.",
    "If there is no evidence, all proofPoints MUST be labeled to_verify and phrased as verification steps (not claims).",
    "\nProject intake:",
    `- Brand category: ${input.project.brandCategory ?? "(missing)"}`,
    `- Product types sought: ${input.project.productTypeSought ?? "(missing)"}`,
    `- Price range: ${input.project.priceRange ?? "(missing)"}`,
    `- Distribution preference: ${input.project.distributionPreference ?? "(missing)"}`,
    `- Geography: ${input.project.geography ?? "(optional)"}`,
    `- Positioning keywords: ${input.project.positioningKeywords ?? "(optional)"}`,
    `- Constraints: ${input.project.constraints ?? "(optional)"}`,
    "\nCandidate:",
    `- Name: ${input.candidate.name}`,
    `- Website: ${input.candidate.website ?? "(none)"}`,
    `- Notes: ${input.candidate.notes ?? "(none)"}`,
    "\nEvidence bullets (user-provided, link-supported):",
    ev,
    "\nScoring criteria (0-5 each): categoryFit, distributionAlignment, recent licensing activity, scale appropriateness, quality/reputation, geo coverage, recent momentum, manufacturing capability.",
    "Disqualifiers (use when applicable): distribution mismatch; wrong category; dormant/dead; known quality issues; extreme scale mismatch.",
    "\nOutput JSON schema:",
    "{\n  criterionScores: { categoryFit: int, distributionAlignment: int, licensingActivity: int, scaleAppropriateness: int, qualityReputation: int, geoCoverage: int, recentMomentum: int, manufacturingCapability: int },\n  disqualifiers: string[],\n  flags: string[],\n  rationaleBullets: string[3-5],\n  proofPoints: [{ text: string, supportType: 'link_supported'|'user_provided_excerpt'|'to_verify'|'assumed', url?: string|null }, ...],\n  confidence: 'High'|'Medium',\n  nextStep: string\n}",
  ].join("\n");
}

export function evidenceSummaryUserPrompt(input: { url: string; text: string; kind: "fetched" | "excerpt" }): string {
  return [
    "Summarize the evidence text into 2-4 short bullets relevant to licensing partner fit.",
    "Do NOT add any facts not in the evidence text.",
    "Return JSON only.",
    `\nEvidence URL: ${input.url}`,
    `Evidence kind: ${input.kind}`,
    "\nEvidence text (truncated):",
    clampText(input.text, 6000),
    "\nOutput JSON schema:",
    "{ bullets: [{ text: string, supportType: 'link_supported'|'user_provided_excerpt' }, ...] }",
  ].join("\n");
}

export function outreachDraftUserPrompt(input: {
  projectBrief: string;
  candidateName: string;
  candidateWebsite?: string | null;
  proofPoints: Array<{ text: string; supportType: string; url?: string | null }>;
}): string {
  const points = input.proofPoints
    .slice(0, 3)
    .map((p) => `- ${clampText(p.text, 180)}${p.url ? ` (source: ${p.url})` : ""}`)
    .join("\n");

  return [
    "Write a warm, professional outreach email draft for a licensing/partnerships conversation.",
    "Avoid spammy marketing language.",
    "Do NOT include personal contact details; use role/title placeholders.",
    "If proof points are to_verify, include placeholders rather than asserting facts.",
    "Return JSON only.",
    "\nProject brief:",
    clampText(input.projectBrief, 700),
    "\nCandidate:",
    `- ${input.candidateName}`,
    `- Website: ${input.candidateWebsite ?? "(none)"}`,
    "\nProof points (may be to_verify):",
    points.length ? points : "(none)",
    "\nOutput JSON schema:",
    "{ subject: string, body: string }",
  ].join("\n");
}
