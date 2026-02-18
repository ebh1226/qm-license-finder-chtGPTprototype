import { type ScoreCard } from "@prisma/client";

export function parseJson<T>(s: string): T {
  return JSON.parse(s) as T;
}

export function safeParseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export type ScoreCardView = ScoreCard & {
  weights: unknown;
  criteria: unknown;
  rationaleBullets: string[];
  proofPoints: Array<{ text: string; supportType: string; url?: string | null }>;
  flags: string[];
  disqualifiers: string[];
};

export function toScoreCardView(sc: ScoreCard): ScoreCardView {
  return {
    ...sc,
    weights: safeParseJson(sc.weightsJson, {}),
    criteria: safeParseJson(sc.criteriaJson, {}),
    rationaleBullets: safeParseJson<string[]>(sc.rationaleJson, []),
    proofPoints: safeParseJson(sc.proofPointsJson, []),
    flags: safeParseJson<string[]>(sc.flagsJson, []),
    disqualifiers: safeParseJson<string[]>(sc.disqualifiersJson, []),
  };
}
