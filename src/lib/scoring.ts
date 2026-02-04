import { type ScoringOutput } from "@/lib/schemas";

export type Weights = {
  categoryFit: number;
  distributionAlignment: number;
  licensingActivity: number;
  scaleAppropriateness: number;
  qualityReputation: number;
  geoCoverage: number;
  recentMomentum: number;
  manufacturingCapability: number;
};

export const DEFAULT_WEIGHTS: Weights = {
  categoryFit: 0.3,
  distributionAlignment: 0.3,
  licensingActivity: 0.2,
  scaleAppropriateness: 0.04,
  qualityReputation: 0.04,
  geoCoverage: 0.04,
  recentMomentum: 0.04,
  manufacturingCapability: 0.04,
};

export function computeTotalScore(out: ScoringOutput, weights: Weights = DEFAULT_WEIGHTS): number {
  const s = out.criterionScores;
  // Weighted average where each criterion is scored 0-5; scale to 0-100.
  const weighted =
    (s.categoryFit / 5) * weights.categoryFit +
    (s.distributionAlignment / 5) * weights.distributionAlignment +
    (s.licensingActivity / 5) * weights.licensingActivity +
    (s.scaleAppropriateness / 5) * weights.scaleAppropriateness +
    (s.qualityReputation / 5) * weights.qualityReputation +
    (s.geoCoverage / 5) * weights.geoCoverage +
    (s.recentMomentum / 5) * weights.recentMomentum +
    (s.manufacturingCapability / 5) * weights.manufacturingCapability;

  return Math.round(weighted * 1000) / 10; // one decimal
}

export function enforceConfidence({
  requested,
  hasEvidence,
}: {
  requested: "High" | "Medium";
  hasEvidence: boolean;
}): "High" | "Medium" {
  if (!hasEvidence) return "Medium";
  return requested;
}

export function normalizeDisqualifiers(disq: string[]): string[] {
  return disq
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function isHardDisqualifier(disq: string): boolean {
  const d = disq.toLowerCase();
  return (
    d.includes("distribution mismatch") ||
    d.includes("wrong category") ||
    d.includes("dormant") ||
    d.includes("dead") ||
    d.includes("website down") ||
    d.includes("quality") && d.includes("issues")
  );
}

export function tierBuckets(scores: Array<{ candidateId: string; totalScore: number; disqualifiers: string[] }>):
  Record<string, "A" | "B" | "C"> {
  // Rank by score, but demote hard disqualifiers.
  const adjusted = scores
    .map((s) => {
      const hard = s.disqualifiers.some(isHardDisqualifier);
      const penalty = hard ? 40 : s.disqualifiers.length ? 15 : 0;
      return {
        ...s,
        adjustedScore: Math.max(0, s.totalScore - penalty),
        hard,
      };
    })
    .sort((a, b) => b.adjustedScore - a.adjustedScore);

  const result: Record<string, "A" | "B" | "C"> = {};
  // Desired sizes.
  const aTarget = 5;
  const bTarget = 7;

  let aCount = 0;
  let bCount = 0;

  for (const s of adjusted) {
    if (s.hard) {
      result[s.candidateId] = "C";
      continue;
    }
    if (aCount < 3) {
      result[s.candidateId] = "A";
      aCount++;
      continue;
    }
    if (aCount < aTarget) {
      // Only allow into A if no disqualifiers.
      if (s.disqualifiers.length === 0) {
        result[s.candidateId] = "A";
        aCount++;
      } else {
        result[s.candidateId] = "B";
        bCount++;
      }
      continue;
    }

    if (bCount < bTarget) {
      result[s.candidateId] = "B";
      bCount++;
    } else {
      result[s.candidateId] = "C";
    }
  }

  // If we ended with >5 A due to odd conditions, demote lowest As.
  if (aCount > aTarget) {
    const aIds = adjusted.filter((s) => result[s.candidateId] === "A").map((s) => s.candidateId);
    const overflow = aIds.slice(aTarget);
    for (const id of overflow) result[id] = "B";
  }

  // Ensure B at least 5 if possible by promoting from C.
  const currentB = Object.values(result).filter((t) => t === "B").length;
  if (currentB < 5) {
    const promote = adjusted
      .filter((s) => result[s.candidateId] === "C" && !s.hard)
      .slice(0, 5 - currentB);
    for (const s of promote) result[s.candidateId] = "B";
  }

  return result;
}
