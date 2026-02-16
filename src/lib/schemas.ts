import { z } from "zod";

export const SupportTypeSchema = z.enum([
  "link_supported",
  "user_provided_excerpt",
  "to_verify",
  "assumed",
]);
export type SupportType = z.infer<typeof SupportTypeSchema>;

export const CandidateSuggestionSchema = z.object({
  name: z.string().min(1).max(120),
  website: z.string().url().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  whyNonObvious: z.string().max(200).optional().nullable(),
});

export const CandidateGenerationSchema = z.object({
  candidates: z.array(CandidateSuggestionSchema).min(8).max(25),
});
export type CandidateGeneration = z.infer<typeof CandidateGenerationSchema>;

export const CriterionScoresSchema = z.object({
  categoryFit: z.number().int().min(0).max(5),
  distributionAlignment: z.number().int().min(0).max(5),
  licensingActivity: z.number().int().min(0).max(5),
  scaleAppropriateness: z.number().int().min(0).max(5),
  qualityReputation: z.number().int().min(0).max(5),
  geoCoverage: z.number().int().min(0).max(5),
  recentMomentum: z.number().int().min(0).max(5),
  manufacturingCapability: z.number().int().min(0).max(5),
});

export const ProofPointSchema = z.object({
  text: z.string().min(1).max(400),
  supportType: SupportTypeSchema,
  url: z.string().url().optional().nullable(),
});

export const ScoringOutputSchema = z.object({
  criterionScores: CriterionScoresSchema,
  disqualifiers: z.array(z.string().min(1).max(80)).max(10).default([]),
  flags: z.array(z.string().min(1).max(120)).max(10).default([]),
  rationaleBullets: z.array(z.string().min(1).max(240)).min(3).max(5),
  proofPoints: z.array(ProofPointSchema).min(2).max(10),
  confidence: z.enum(["High", "Medium", "Low"]),
  nextStep: z.string().min(1).max(400),
});
export type ScoringOutput = z.infer<typeof ScoringOutputSchema>;

export const OutreachDraftSchema = z.object({
  subject: z.string().min(1).max(140),
  body: z.string().min(20).max(2500),
});
export type OutreachDraftOutput = z.infer<typeof OutreachDraftSchema>;

export const CandidateResearchSchema = z.object({
  website: z.string().url().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  licensingHistory: z.string().max(400).optional().nullable(),
  keyProducts: z.string().max(300).optional().nullable(),
  distributionChannels: z.string().max(300).optional().nullable(),
  notablePartnerships: z.string().max(300).optional().nullable(),
  searchQueries: z.array(z.string().max(200)).min(1).max(3),
});
export type CandidateResearchOutput = z.infer<typeof CandidateResearchSchema>;

export const EvidenceSummarySchema = z.object({
  bullets: z.array(
    z.object({
      text: z.string().min(1).max(280),
      supportType: z.enum(["link_supported", "user_provided_excerpt"]),
    })
  ).min(2).max(4),
});
export type EvidenceSummaryOutput = z.infer<typeof EvidenceSummarySchema>;
