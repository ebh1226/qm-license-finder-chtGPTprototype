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
    customData?: string | null;
  };
  evidenceBullets: Array<{ text: string; url?: string | null }>;
}): string {
  const ev = input.evidenceBullets.length
    ? input.evidenceBullets
        .slice(0, 8)
        .map((b, i) => `  ${i + 1}. ${clampText(b.text, 240)}${b.url ? ` (source: ${b.url})` : ""}`)
        .join("\n")
    : "  (none)";

  // Build candidate section, including any extra user-provided CSV columns
  const candidateLines = [
    `- Name: ${input.candidate.name}`,
    `- Website: ${input.candidate.website ?? "(none)"}`,
    `- Notes: ${input.candidate.notes ?? "(none)"}`,
  ];
  if (input.candidate.customData) {
    try {
      const custom = JSON.parse(input.candidate.customData) as Record<string, string>;
      const entries = Object.entries(custom).slice(0, 20);
      if (entries.length > 0) {
        candidateLines.push("\nAdditional user-provided data:");
        for (const [key, value] of entries) {
          candidateLines.push(`- ${key}: ${clampText(value, 300)}`);
        }
      }
    } catch { /* ignore malformed JSON */ }
  }

  return [
    "Score the candidate for licensing partner fit for this project.",
    "You MUST follow the scoring criteria and constraints.",
    "Evidence sources include: link-supported evidence bullets, user-provided notes, and additional user-provided data fields. All of these count as real evidence when assessing the evidence level.",
    "If there is NO evidence at all (no evidence bullets, no notes, no user-provided data), all proofPoints MUST be labeled to_verify and phrased as verification steps (not claims).",
    "If the candidate has user-provided notes or additional data, use supportType 'user_provided_excerpt' for claims derived from that data.",
    "The 'confidence' field represents the EVIDENCE LEVEL — how much supporting evidence is available, NOT how certain the AI is. Set it to 'High' when multiple evidence sources corroborate the assessment, 'Medium' when some evidence supports it, and 'Low' only when there is little or no evidence.",
    "\nProject intake:",
    `- Brand category: ${input.project.brandCategory ?? "(missing)"}`,
    `- Product types sought: ${input.project.productTypeSought ?? "(missing)"}`,
    `- Price range: ${input.project.priceRange ?? "(missing)"}`,
    `- Distribution preference: ${input.project.distributionPreference ?? "(missing)"}`,
    `- Geography: ${input.project.geography ?? "(optional)"}`,
    `- Positioning keywords: ${input.project.positioningKeywords ?? "(optional)"}`,
    `- Constraints: ${input.project.constraints ?? "(optional)"}`,
    "\nCandidate:",
    ...candidateLines,
    "\nEvidence bullets (user-provided, link-supported):",
    ev,
    "\nScoring criteria (0-5 each): categoryFit, distributionAlignment, recent licensing activity, scale appropriateness, quality/reputation, geo coverage, recent momentum, manufacturing capability.",
    "Disqualifiers (use EXACT labels when applicable):",
    "  - 'distribution mismatch' — the candidate's distribution channels are fundamentally incompatible (e.g., mass market vs. specialty/premium). This is an automatic disqualifier that zeros the Distribution pillar.",
    "  - 'wrong category' — the candidate operates in a completely unrelated product category. This is an automatic disqualifier that zeros the Category pillar.",
    "  - 'dormant/dead' — the company appears inactive, defunct, or has a non-functional website.",
    "  - 'known quality issues' — the company has documented quality or reputation problems.",
    "  - 'extreme scale mismatch' — the candidate is far too large or too small for the project.",
    "Use these exact phrases as disqualifier strings so they can be detected programmatically.",
    "\nOutput JSON schema:",
    "{\n  criterionScores: { categoryFit: int, distributionAlignment: int, licensingActivity: int, scaleAppropriateness: int, qualityReputation: int, geoCoverage: int, recentMomentum: int, manufacturingCapability: int },\n  disqualifiers: string[],\n  flags: string[],\n  rationaleBullets: string[3-5],\n  proofPoints: [{ text: string, supportType: 'link_supported'|'user_provided_excerpt'|'to_verify'|'assumed', url?: string|null }, ...],\n  confidence: 'High'|'Medium'|'Low',\n  nextStep: string\n}",
  ].join("\n");
}

export function candidateResearchUserPrompt(input: {
  candidateName: string;
  candidateWebsite?: string | null;
  candidateNotes?: string | null;
  brandCategory?: string | null;
  productTypeSought?: string | null;
}): string {
  return [
    "Research the following company as a potential licensing partner.",
    "Return what you know about this company. Do NOT invent facts — only include information you are confident about.",
    "If you are not confident about a field, return null for that field.",
    "Also suggest 1-3 Google search queries that would find useful public information about this company's licensing activity, partnerships, products, or distribution.",
    "",
    `Company name: ${input.candidateName}`,
    `Known website: ${input.candidateWebsite ?? "(none)"}`,
    `Known notes: ${input.candidateNotes ?? "(none)"}`,
    "",
    "Context for search query generation:",
    `- Brand category: ${input.brandCategory ?? "(unknown)"}`,
    `- Product types sought: ${input.productTypeSought ?? "(unknown)"}`,
    "",
    "Output JSON schema:",
    "{ website?: string|null, description?: string|null, category?: string|null, licensingHistory?: string|null, keyProducts?: string|null, distributionChannels?: string|null, notablePartnerships?: string|null, searchQueries: string[1-3] }",
  ].join("\n");
}

export function evidenceSummaryUserPrompt(input: { url: string; text: string; kind: "fetched" | "excerpt" }): string {
  return [
    "Summarize the evidence text into 1-4 short bullets relevant to licensing partner fit.",
    "If the page contains no useful information about the company or licensing, return an empty bullets array.",
    "Do NOT add any facts not in the evidence text.",
    "Return JSON only.",
    `\nEvidence URL: ${input.url}`,
    `Evidence kind: ${input.kind}`,
    "\nEvidence text (truncated):",
    clampText(input.text, 6000),
    "\nOutput JSON schema:",
    "{ bullets: [{ text: string }, ...] }",
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
