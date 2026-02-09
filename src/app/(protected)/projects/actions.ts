"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  CandidateGenerationSchema,
  EvidenceSummarySchema,
  OutreachDraftSchema,
  ScoringOutputSchema,
  type OutreachDraftOutput,
  type ScoringOutput,
} from "@/lib/schemas";
import { runStructured } from "@/lib/llm";
import {
  candidateGenerationUserPrompt,
  evidenceSummaryUserPrompt,
  outreachDraftUserPrompt,
  scoreCandidateUserPrompt,
  systemPreamble,
} from "@/lib/prompts";
import {
  DEFAULT_GIANTS_EXCLUDE,
  clampText,
  isExcluded,
  normalizeUrl,
  parseCsvCandidates,
  parseExcludeList,
  redactPotentialContactDetails,
} from "@/lib/utils";
import { fetchPublicUrlText } from "@/lib/evidence";
import { DEFAULT_WEIGHTS, computeTotalScore, enforceConfidence, tierBuckets } from "@/lib/scoring";

function projectBrief(p: {
  brandCategory?: string | null;
  productTypeSought?: string | null;
  priceRange?: string | null;
  distributionPreference?: string | null;
  geography?: string | null;
  positioningKeywords?: string | null;
  constraints?: string | null;
}): string {
  return [
    `Brand category: ${p.brandCategory ?? "(missing)"}`,
    `Product types sought: ${p.productTypeSought ?? "(missing)"}`,
    `Price range: ${p.priceRange ?? "(missing)"}`,
    `Distribution preference: ${p.distributionPreference ?? "(missing)"}`,
    `Geography: ${p.geography ?? "(optional)"}`,
    `Positioning keywords: ${p.positioningKeywords ?? "(optional)"}`,
    `Constraints: ${p.constraints ?? "(optional)"}`,
  ].join("\n");
}

export async function createProjectAction(formData: FormData) {
  const user = await requireAuth();

  const name = String(formData.get("name") || "Untitled Project").slice(0, 80);
  const project = await prisma.project.create({
    data: {
      ownerId: user.id,
      name,
      brandCategory: nullIfEmpty(formData.get("brandCategory")),
      productTypeSought: nullIfEmpty(formData.get("productTypeSought")),
      priceRange: nullIfEmpty(formData.get("priceRange")),
      distributionPreference: nullIfEmpty(formData.get("distributionPreference")),
      geography: nullIfEmpty(formData.get("geography")),
      positioningKeywords: nullIfEmpty(formData.get("positioningKeywords")),
      constraints: nullIfEmpty(formData.get("constraints")),
      excludeList: nullIfEmpty(formData.get("excludeList")),
    },
    select: { id: true },
  });

  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  await requireAuth();

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name: String(formData.get("name") || "Untitled Project").slice(0, 80),
      brandCategory: nullIfEmpty(formData.get("brandCategory")),
      productTypeSought: nullIfEmpty(formData.get("productTypeSought")),
      priceRange: nullIfEmpty(formData.get("priceRange")),
      distributionPreference: nullIfEmpty(formData.get("distributionPreference")),
      geography: nullIfEmpty(formData.get("geography")),
      positioningKeywords: nullIfEmpty(formData.get("positioningKeywords")),
      constraints: nullIfEmpty(formData.get("constraints")),
      excludeList: nullIfEmpty(formData.get("excludeList")),
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/results`);
}

export async function addCandidateAction(projectId: string, formData: FormData) {
  await requireAuth();

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const website = normalizeUrl(nullIfEmpty(formData.get("website")));
  const notes = nullIfEmpty(formData.get("notes"));

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { excludeList: true } });
  const exclude = [...DEFAULT_GIANTS_EXCLUDE, ...parseExcludeList(project?.excludeList)];
  if (isExcluded(name, exclude)) {
    // Silently ignore adds that are excluded.
    return;
  }

  await prisma.candidate.create({
    data: {
      projectId,
      name,
      website,
      notes,
      provenance: "manual",
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function uploadCandidatesCsvAction(projectId: string, formData: FormData) {
  await requireAuth();

  const file = formData.get("file");
  if (!(file instanceof File)) return;

  const text = await file.text();
  const rows = parseCsvCandidates(text);
  if (!rows.length) return;

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { excludeList: true } });
  const exclude = [...DEFAULT_GIANTS_EXCLUDE, ...parseExcludeList(project?.excludeList)];

  for (const r of rows.slice(0, 200)) {
    if (isExcluded(r.name, exclude)) continue;
    await prisma.candidate.create({
      data: {
        projectId,
        name: r.name.trim().slice(0, 120),
        website: normalizeUrl(r.website ?? null),
        notes: r.notes?.slice(0, 500),
        provenance: "uploaded",
      },
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function generateCandidatesAction(projectId: string) {
  await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      brandCategory: true,
      productTypeSought: true,
      priceRange: true,
      distributionPreference: true,
      geography: true,
      positioningKeywords: true,
      constraints: true,
      excludeList: true,
    },
  });
  if (!project) return;

  const exclude = [...DEFAULT_GIANTS_EXCLUDE, ...parseExcludeList(project.excludeList)];

  const system = systemPreamble();
  const user = candidateGenerationUserPrompt({ ...project, excludeList: exclude });

  const { data } = await runStructured({
    promptName: "candidate_generation",
    system,
    user,
    schema: CandidateGenerationSchema,
  });

  const candidates = data.candidates
    .map((c) => ({
      name: c.name.trim(),
      website: normalizeUrl(c.website ?? null),
      notes: (c.notes ?? "").trim() || null,
    }))
    .filter((c) => c.name.length > 0)
    .filter((c) => !isExcluded(c.name, exclude))
    .slice(0, 25);

  // De-dupe against existing names.
  const existing = await prisma.candidate.findMany({ where: { projectId }, select: { name: true } });
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

  for (const c of candidates) {
    if (existingNames.has(c.name.toLowerCase())) continue;
    await prisma.candidate.create({
      data: {
        projectId,
        name: c.name.slice(0, 120),
        website: c.website,
        notes: c.notes?.slice(0, 500),
        provenance: "generated",
      },
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function addEvidenceLinkAction(candidateId: string, formData: FormData) {
  await requireAuth();

  const url = normalizeUrl(nullIfEmpty(formData.get("url")));
  const excerpt = nullIfEmpty(formData.get("excerpt"));
  if (!url) return;

  const created = await prisma.evidenceLink.create({
    data: {
      candidateId,
      url,
      excerpt: excerpt?.slice(0, 2000),
    },
    select: { id: true, candidateId: true },
  });

  // Optional: immediately summarize.
  await summarizeEvidenceLinkAction(created.id);

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { projectId: true } });
  revalidatePath(`/projects/${candidate?.projectId}`);
}

export async function summarizeEvidenceLinkAction(evidenceLinkId: string) {
  await requireAuth();

  const link = await prisma.evidenceLink.findUnique({
    where: { id: evidenceLinkId },
    select: { id: true, url: true, excerpt: true },
  });
  if (!link) return;

  let text: string | null = null;
  let kind: "fetched" | "excerpt" = "fetched";

  if (link.excerpt) {
    text = link.excerpt;
    kind = "excerpt";
  } else {
    const fetched = await fetchPublicUrlText(link.url);
    if (fetched.ok && fetched.text) {
      text = fetched.text;
    } else {
      // Persist failure state (no text). User can paste excerpt later.
      await prisma.evidenceLink.update({ where: { id: link.id }, data: { fetchedText: null } });
      return;
    }
  }

  const system = systemPreamble();
  const user = evidenceSummaryUserPrompt({ url: link.url, text, kind });

  const { data } = await runStructured({
    promptName: "evidence_summary",
    system,
    user,
    schema: EvidenceSummarySchema,
  });

  await prisma.evidenceLink.update({
    where: { id: link.id },
    data: {
      fetchedText: kind === "fetched" ? clampText(text, 12000) : null,
      summaryJson: JSON.stringify(data.bullets),
    },
  });
}

export async function scoreAndTierProjectAction(projectId: string) {
  await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      candidates: {
        include: { evidenceLinks: true, scoreCard: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!project) return;

  for (let ci = 0; ci < project.candidates.length; ci++) {
    // Small delay between API calls to avoid rate-limiting (skip first)
    if (ci > 0) await new Promise((r) => setTimeout(r, 1000));

    const candidate = project.candidates[ci];
    const evidenceBullets = candidate.evidenceLinks
      .flatMap((l) => {
        const bullets = safeJsonParseArray<{ text: string; supportType: string }>(l.summaryJson);
        return bullets.map((b) => ({ text: b.text, url: l.url }));
      })
      .slice(0, 8);

    const system = systemPreamble();
    const user = scoreCandidateUserPrompt({
      project,
      candidate,
      evidenceBullets,
    });

    const { data } = await runStructured({
      promptName: "score_candidate",
      system,
      user,
      schema: ScoringOutputSchema,
    });

    const cleaned = cleanScoringOutput(data, evidenceBullets.length > 0);

    const totalScore = computeTotalScore(cleaned, DEFAULT_WEIGHTS);

    await prisma.scoreCard.upsert({
      where: { candidateId: candidate.id },
      create: {
        candidateId: candidate.id,
        weightsJson: JSON.stringify(DEFAULT_WEIGHTS),
        criteriaJson: JSON.stringify(cleaned.criterionScores),
        totalScore,
        tier: "C", // temporary; set after ranking
        confidence: cleaned.confidence === "High" ? "High" : "Medium",
        rationaleJson: JSON.stringify(cleaned.rationaleBullets),
        proofPointsJson: JSON.stringify(cleaned.proofPoints),
        flagsJson: JSON.stringify(cleaned.flags),
        disqualifiersJson: JSON.stringify(cleaned.disqualifiers),
        nextStep: cleaned.nextStep,
      },
      update: {
        weightsJson: JSON.stringify(DEFAULT_WEIGHTS),
        criteriaJson: JSON.stringify(cleaned.criterionScores),
        totalScore,
        confidence: cleaned.confidence === "High" ? "High" : "Medium",
        rationaleJson: JSON.stringify(cleaned.rationaleBullets),
        proofPointsJson: JSON.stringify(cleaned.proofPoints),
        flagsJson: JSON.stringify(cleaned.flags),
        disqualifiersJson: JSON.stringify(cleaned.disqualifiers),
        nextStep: cleaned.nextStep,
      },
    });
  }

  // Tiering pass
  const scoreCards = await prisma.scoreCard.findMany({
    where: { candidate: { projectId } },
    select: { candidateId: true, totalScore: true, disqualifiersJson: true },
  });

  const tierMap = tierBuckets(
    scoreCards.map((s) => ({
      candidateId: s.candidateId,
      totalScore: s.totalScore,
      disqualifiers: safeJsonParseArray<string>(s.disqualifiersJson),
    }))
  );

  for (const [candidateId, tier] of Object.entries(tierMap)) {
    await prisma.scoreCard.update({ where: { candidateId }, data: { tier } });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/results`);
}

export async function generateOutreachForATierAction(projectId: string) {
  await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      candidates: {
        include: { scoreCard: true, outreachDraft: true },
      },
    },
  });
  if (!project) return;

  const aCandidates = project.candidates.filter((c) => c.scoreCard?.tier === "A");

  for (let ci = 0; ci < aCandidates.length; ci++) {
    // Small delay between API calls to avoid rate-limiting (skip first)
    if (ci > 0) await new Promise((r) => setTimeout(r, 1000));

    const c = aCandidates[ci];
    if (!c.scoreCard) continue;

    const proofPoints = safeJsonParseArray<{ text: string; supportType: string; url?: string | null }>(
      c.scoreCard.proofPointsJson
    );

    const system = systemPreamble();
    const user = outreachDraftUserPrompt({
      projectBrief: projectBrief(project),
      candidateName: c.name,
      candidateWebsite: c.website,
      proofPoints,
    });

    const { data } = await runStructured({
      promptName: "outreach_draft",
      system,
      user,
      schema: OutreachDraftSchema,
    });

    const cleaned = cleanOutreachDraft(data);

    await prisma.outreachDraft.upsert({
      where: { candidateId: c.id },
      create: {
        candidateId: c.id,
        tonePreset: "warm_professional",
        subject: cleaned.subject,
        body: cleaned.body,
      },
      update: {
        subject: cleaned.subject,
        body: cleaned.body,
      },
    });

    await prisma.outcomeEvent.create({
      data: {
        candidateId: c.id,
        type: "status_change",
        payloadJson: JSON.stringify({ status: "outreach_drafted" }),
      },
    });
  }

  revalidatePath(`/projects/${projectId}/results`);
  revalidatePath(`/projects/${projectId}`);
}

export async function saveProjectFeedbackAction(projectId: string, formData: FormData) {
  await requireAuth();

  const ratingRaw = String(formData.get("rating") || "").trim();
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const notes = nullIfEmpty(formData.get("notes"));

  await prisma.projectFeedback.upsert({
    where: { projectId },
    create: { projectId, rating: rating ?? undefined, notes },
    update: { rating: rating ?? undefined, notes },
  });

  revalidatePath(`/projects/${projectId}/results`);
}

export async function saveCandidateFeedbackAction(candidateId: string, formData: FormData) {
  await requireAuth();

  const misfit = String(formData.get("misfit") || "") === "on";
  const reason = nullIfEmpty(formData.get("reason"));

  await prisma.candidateFeedback.upsert({
    where: { candidateId },
    create: { candidateId, misfit, reason },
    update: { misfit, reason },
  });

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { projectId: true } });
  revalidatePath(`/projects/${candidate?.projectId}/results`);
}

function nullIfEmpty(v: FormDataEntryValue | null): string | null {
  const s = v === null ? "" : String(v);
  const trimmed = s.trim();
  return trimmed.length ? trimmed : null;
}

function safeJsonParseArray<T>(s?: string | null): T[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function cleanScoringOutput(out: ScoringOutput, hasEvidence: boolean): ScoringOutput {
  const sanitized: ScoringOutput = {
    ...out,
    flags: (out.flags ?? []).map((f) => redactPotentialContactDetails(f)).slice(0, 10),
    disqualifiers: (out.disqualifiers ?? []).map((d) => redactPotentialContactDetails(d)).slice(0, 10),
    rationaleBullets: out.rationaleBullets.map((b) => redactPotentialContactDetails(b)).slice(0, 5),
    proofPoints: out.proofPoints.map((p) => ({
      ...p,
      text: redactPotentialContactDetails(p.text),
    })),
    nextStep: redactPotentialContactDetails(out.nextStep),
    confidence: enforceConfidence({ requested: out.confidence, hasEvidence }),
  };

  // If no evidence, force all proofPoints to to_verify.
  if (!hasEvidence) {
    sanitized.proofPoints = sanitized.proofPoints.map((p) => ({ ...p, supportType: "to_verify" }));
  }

  return sanitized;
}

function cleanOutreachDraft(out: OutreachDraftOutput): OutreachDraftOutput {
  return {
    subject: clampText(redactPotentialContactDetails(out.subject), 140),
    body: clampText(redactPotentialContactDetails(out.body), 2500),
  };
}
