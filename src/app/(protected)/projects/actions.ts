"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  CandidateGenerationSchema,
  CandidateResearchSchema,
  EvidenceSummarySchema,
  OutreachDraftSchema,
  ScoringOutputSchema,
  type OutreachDraftOutput,
  type ScoringOutput,
} from "@/lib/schemas";
import { runStructured } from "@/lib/llm";
import {
  candidateGenerationUserPrompt,
  candidateResearchUserPrompt,
  evidenceSummaryUserPrompt,
  outreachDraftUserPrompt,
  scoreCandidateUserPrompt,
  systemPreamble,
} from "@/lib/prompts";
import {
  clampText,
  isExcluded,
  normalizeUrl,
  parseCsvCandidates,
  parseExcludeList,
  redactPotentialContactDetails,
} from "@/lib/utils";
import { fetchPublicUrlText } from "@/lib/evidence";
import { googleCustomSearch } from "@/lib/search";
import { DEFAULT_WEIGHTS, computeTotalScore, enforceConfidence, tierBuckets } from "@/lib/scoring";

function projectBrief(p: {
  brandCategory?: string | null;
  productTypeSought?: string | null;
  priceRange?: string | null;
  distributionPreference?: string | null;
  geography?: string | null;
  positioningKeywords?: string | null;
  constraints?: string | null;
  brandBackground?: string | null;
  brandWebsite?: string | null;
}): string {
  return [
    `Brand category: ${p.brandCategory ?? "(missing)"}`,
    `Product types sought: ${p.productTypeSought ?? "(missing)"}`,
    `Price range: ${p.priceRange ?? "(missing)"}`,
    `Distribution preference: ${p.distributionPreference ?? "(missing)"}`,
    `Geography: ${p.geography ?? "(optional)"}`,
    `Positioning keywords: ${p.positioningKeywords ?? "(optional)"}`,
    `Constraints: ${p.constraints ?? "(optional)"}`,
    p.brandBackground ? `Brand background: ${p.brandBackground}` : null,
    p.brandWebsite ? `Brand website: ${p.brandWebsite}` : null,
  ].filter(Boolean).join("\n");
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
      brandBackground: nullIfEmpty(formData.get("brandBackground")),
      brandWebsite: nullIfEmpty(formData.get("brandWebsite")),
    },
    select: { id: true },
  });

  redirect(`/projects/${project.id}/setup`);
}

export async function deleteProjectAction(projectId: string) {
  await requireAuth();
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
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
      brandBackground: nullIfEmpty(formData.get("brandBackground")),
      brandWebsite: nullIfEmpty(formData.get("brandWebsite")),
    },
  });

  redirect(`/projects/${projectId}`);
}

export async function addCandidateAction(projectId: string, formData: FormData) {
  await requireAuth();

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const website = normalizeUrl(nullIfEmpty(formData.get("website")));
  const notes = nullIfEmpty(formData.get("notes"));

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { excludeList: true } });
  const exclude = parseExcludeList(project?.excludeList);
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
  revalidatePath(`/projects/${projectId}/candidates`);
}

// Recompute brandContextText from all ProjectDocument records for a project
async function recomputeBrandContextText(projectId: string) {
  const docs = await prisma.projectDocument.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: { extractedText: true },
  });
  const combined = docs
    .map((d) => d.extractedText.trim())
    .filter(Boolean)
    .join("\n\n---\n\n");
  await prisma.project.update({
    where: { id: projectId },
    data: { brandContextText: combined ? clampText(combined, 30000) : null },
  });
}

export async function uploadBrandDocumentAction(projectId: string, formData: FormData) {
  await requireAuth();

  const file = formData.get("file");
  if (!(file instanceof File)) return;

  const ext = file.name.split(".").pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let extractedText = "";

  try {
    if (ext === "pdf") {
      // Use Gemini API to extract text from PDFs — pdfjs-based libraries require
      // browser APIs (DOMMatrix) not available in Node.js 20.
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No GEMINI_API_KEY configured");
      const model = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } },
              { text: "Extract all text from this document. Return only the raw text content, preserving paragraph breaks. Do not add commentary." },
            ],
          }],
          generationConfig: { temperature: 0 },
        }),
      });
      if (!resp.ok) throw new Error(`Gemini PDF extraction ${resp.status}`);
      const data = (await resp.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else if (ext === "pptx" || ext === "ppt" || ext === "docx") {
      // officeparser Node.js build handles DOCX/PPTX via zip+XML — no browser APIs needed
      const { parseOffice } = await import("officeparser");
      const ast = await parseOffice(buffer);
      extractedText = ast.toText();
    } else if (ext === "txt") {
      extractedText = buffer.toString("utf-8");
    } else {
      return;
    }
  } catch (err) {
    console.error("Failed to extract text from brand document:", err);
    return;
  }

  if (!extractedText.trim()) return;

  await prisma.projectDocument.create({
    data: {
      projectId,
      filename: file.name,
      extractedText: clampText(extractedText.trim(), 30000),
    },
  });

  await recomputeBrandContextText(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/setup`);
}

export async function deleteProjectDocumentAction(documentId: string) {
  await requireAuth();

  const doc = await prisma.projectDocument.findUnique({
    where: { id: documentId },
    select: { projectId: true },
  });
  if (!doc) return;

  await prisma.projectDocument.delete({ where: { id: documentId } });
  await recomputeBrandContextText(doc.projectId);

  revalidatePath(`/projects/${doc.projectId}`);
  revalidatePath(`/projects/${doc.projectId}/setup`);
}

export async function uploadCandidatesCsvAction(projectId: string, formData: FormData) {
  await requireAuth();

  const file = formData.get("file");
  if (!(file instanceof File)) return;

  const ext = file.name.split(".").pop()?.toLowerCase();
  let text: string;

  if (ext === "xlsx" || ext === "xls") {
    const { read: xlsxRead, utils: xlsxUtils } = await import("xlsx");
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsxRead(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    text = xlsxUtils.sheet_to_csv(sheet);
  } else {
    text = await file.text();
  }

  const rows = parseCsvCandidates(text);
  if (!rows.length) return;

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { excludeList: true } });
  const exclude = parseExcludeList(project?.excludeList);

  for (const r of rows.slice(0, 200)) {
    if (!r.name.trim()) continue;
    if (isExcluded(r.name, exclude)) continue;
    const candidate = await prisma.candidate.create({
      data: {
        projectId,
        name: r.name.trim().slice(0, 120),
        website: normalizeUrl(r.website ?? null),
        notes: r.notes?.slice(0, 500),
        customData: r.extraColumns ? JSON.stringify(r.extraColumns) : null,
        provenance: "uploaded",
      },
    });

    // Create evidence links from CSV links column + website
    const evidenceUrls = new Set<string>();
    const candidateWebsite = normalizeUrl(r.website ?? null);
    if (candidateWebsite) evidenceUrls.add(candidateWebsite);
    if (r.links?.length) {
      for (const rawUrl of r.links.slice(0, 10)) {
        const url = normalizeUrl(rawUrl);
        if (url) evidenceUrls.add(url);
      }
    }
    for (const url of evidenceUrls) {
      await prisma.evidenceLink.create({
        data: { candidateId: candidate.id, url },
      });
    }
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteCandidateAction(candidateId: string) {
  await requireAuth();
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { projectId: true } });
  if (!candidate) return;
  await prisma.candidate.delete({ where: { id: candidateId } });
  revalidatePath(`/projects/${candidate.projectId}`);
}

export async function clearAllCandidatesAction(projectId: string) {
  await requireAuth();
  await prisma.candidate.deleteMany({ where: { projectId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/candidates`);
}

// Internal helper: research a single candidate (LLM knowledge + web search + evidence summarization)
async function researchSingleCandidate(
  candidate: { id: string; name: string; website: string | null; notes: string | null },
  projectContext: { brandCategory: string | null; productTypeSought: string | null; brandBackground?: string | null; brandWebsite?: string | null },
) {
  // --- PHASE 1: LLM Knowledge ---
  const system = systemPreamble();
  const user = candidateResearchUserPrompt({
    candidateName: candidate.name,
    candidateWebsite: candidate.website,
    candidateNotes: candidate.notes,
    brandCategory: projectContext.brandCategory,
    productTypeSought: projectContext.productTypeSought,
    brandBackground: projectContext.brandBackground,
    brandWebsite: projectContext.brandWebsite,
  });

  const { data: research } = await runStructured({
    promptName: "candidate_research",
    system,
    user,
    schema: CandidateResearchSchema,
  });

  // Auto-fill website if not already set
  const updatedWebsite = candidate.website || normalizeUrl(research.website ?? null);

  // Merge LLM knowledge into notes (preserve existing notes).
  // Skip description if notes already exist — generated/manual notes cover the same
  // ground and concatenating causes visible repetition in the UI.
  const hasExistingNotes = !!candidate.notes?.trim();
  const knowledgeParts = [
    !hasExistingNotes ? research.description : null,
    research.category ? `Category: ${research.category}` : null,
    research.licensingHistory ? `Licensing: ${research.licensingHistory}` : null,
    research.keyProducts ? `Products: ${research.keyProducts}` : null,
    research.distributionChannels ? `Distribution: ${research.distributionChannels}` : null,
    research.notablePartnerships ? `Partnerships: ${research.notablePartnerships}` : null,
  ].filter(Boolean).join(" | ");

  const updatedNotes = clampText(
    redactPotentialContactDetails(
      [candidate.notes, knowledgeParts].filter(Boolean).join(" | ")
    ),
    500
  ) || null;

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      website: updatedWebsite,
      notes: updatedNotes,
    },
  });

  // --- PHASE 2: Web Search (parallel) ---
  const searchResultArrays = await Promise.all(
    research.searchQueries.slice(0, 3).map(async (query) => {
      try {
        return await googleCustomSearch(`${query} after:2022`, 2);
      } catch (err) {
        console.error(`Search failed for "${candidate.name}" query "${query}":`, err);
        return [];
      }
    })
  );

  const allUrls: Array<{ url: string; title: string }> = [];
  for (const results of searchResultArrays) {
    for (const r of results) {
      const normalized = normalizeUrl(r.url);
      if (normalized && !allUrls.some((u) => u.url === normalized)) {
        allUrls.push({ url: normalized, title: r.title });
      }
    }
  }

  // --- PHASE 3: Fetch & Summarize (parallel) ---
  await Promise.all(
    allUrls.slice(0, 3).map(async ({ url }) => {
      try {
        const link = await prisma.evidenceLink.create({
          data: { candidateId: candidate.id, url },
          select: { id: true },
        });

        const fetched = await fetchPublicUrlText(url);
        if (fetched.ok && fetched.text) {
          const { data: summary } = await runStructured({
            promptName: "evidence_summary",
            system: systemPreamble(),
            user: evidenceSummaryUserPrompt({ url, text: fetched.text, kind: "fetched" }),
            schema: EvidenceSummarySchema,
          });

          if (summary.bullets.length === 0) {
            await prisma.evidenceLink.delete({ where: { id: link.id } });
          } else {
            await prisma.evidenceLink.update({
              where: { id: link.id },
              data: {
                fetchedText: clampText(fetched.text, 12000),
                summaryJson: JSON.stringify(summary.bullets),
              },
            });
          }
        }
      } catch (err) {
        console.error(`Evidence processing failed for "${candidate.name}" URL "${url}":`, err);
      }
    })
  );
}

export async function researchCandidatesAction(projectId: string) {
  await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      candidates: {
        include: { evidenceLinks: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!project) return;

  // Only research candidates that have no evidence links yet
  const toResearch = project.candidates.filter(
    (c) => c.evidenceLinks.length === 0 && c.name.trim()
  );

  for (let ci = 0; ci < toResearch.length; ci++) {
    if (ci > 0) await new Promise((r) => setTimeout(r, 1000));
    try {
      await researchSingleCandidate(toResearch[ci], project);
    } catch (err) {
      console.error(`Research failed for candidate "${toResearch[ci].name}":`, err);
    }
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/candidates`);
}

export async function researchCandidatesBatchAction(projectId: string, candidateIds: string[]) {
  await requireAuth();
  if (!candidateIds.length) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { brandCategory: true, productTypeSought: true, brandBackground: true, brandWebsite: true },
  });
  if (!project) return;

  const candidates = await prisma.candidate.findMany({
    where: { id: { in: candidateIds }, projectId },
    include: { evidenceLinks: true },
  });

  const toResearch = candidates.filter((c) => c.evidenceLinks.length === 0 && c.name.trim());

  for (let ci = 0; ci < toResearch.length; ci++) {
    if (ci > 0) await new Promise((r) => setTimeout(r, 1000));
    try {
      await researchSingleCandidate(toResearch[ci], project);
    } catch (err) {
      console.error(`Research failed for candidate "${toResearch[ci].name}":`, err);
    }
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/candidates`);
}

export async function researchOneCandidateAction(projectId: string, candidateId: string) {
  await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { brandCategory: true, productTypeSought: true, brandBackground: true, brandWebsite: true },
  });
  if (!project) return;

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId, projectId },
    include: { evidenceLinks: true },
  });
  if (!candidate || !candidate.name.trim() || candidate.evidenceLinks.length > 0) return;

  await researchSingleCandidate(candidate, project);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/candidates`);
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
      brandBackground: true,
      brandWebsite: true,
      brandContextText: true,
    },
  });
  if (!project) return;

  const exclude = parseExcludeList(project.excludeList);

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
  revalidatePath(`/projects/${projectId}/candidates`);
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

// Internal helper: score a single candidate
async function scoreSingleCandidate(
  candidate: { id: string; name: string; website: string | null; notes: string | null; customData: string | null; evidenceLinks: Array<{ id: string; url: string; summaryJson: string | null; fetchedText: string | null; excerpt: string | null; candidateId: string; createdAt: Date; updatedAt: Date }> },
  project: { brandCategory: string | null; productTypeSought: string | null; priceRange: string | null; distributionPreference: string | null; geography: string | null; positioningKeywords: string | null; constraints: string | null; brandBackground?: string | null; brandWebsite?: string | null; brandContextText?: string | null },
) {
  if (!candidate.name.trim()) return;

  // Auto-disqualify candidates with no usable information
  const hasInfo = candidate.website || candidate.notes?.trim() || candidate.customData || candidate.evidenceLinks.length > 0;
  if (!hasInfo) {
    await prisma.scoreCard.upsert({
      where: { candidateId: candidate.id },
      create: {
        candidateId: candidate.id,
        weightsJson: JSON.stringify(DEFAULT_WEIGHTS),
        criteriaJson: JSON.stringify({ categoryFit: 0, distributionAlignment: 0, licensingActivity: 0, scaleAppropriateness: 0, qualityReputation: 0, geoCoverage: 0, recentMomentum: 0, manufacturingCapability: 0 }),
        totalScore: 0,
        tier: "C",
        confidence: "Low",
        rationaleJson: JSON.stringify(["No information available to evaluate this candidate."]),
        proofPointsJson: JSON.stringify([]),
        flagsJson: JSON.stringify([]),
        disqualifiersJson: JSON.stringify(["No information available; cannot evaluate"]),
        nextStep: "Provide a website, notes, or evidence links before scoring.",
      },
      update: {
        criteriaJson: JSON.stringify({ categoryFit: 0, distributionAlignment: 0, licensingActivity: 0, scaleAppropriateness: 0, qualityReputation: 0, geoCoverage: 0, recentMomentum: 0, manufacturingCapability: 0 }),
        totalScore: 0,
        confidence: "Low",
        rationaleJson: JSON.stringify(["No information available to evaluate this candidate."]),
        proofPointsJson: JSON.stringify([]),
        flagsJson: JSON.stringify([]),
        disqualifiersJson: JSON.stringify(["No information available; cannot evaluate"]),
        nextStep: "Provide a website, notes, or evidence links before scoring.",
      },
    });
    return;
  }

  // Auto-summarize any unsummarized evidence links before scoring
  for (const link of candidate.evidenceLinks) {
    if (link.summaryJson) continue;
    try {
      const fetched = await fetchPublicUrlText(link.url);
      if (fetched.ok && fetched.text) {
        const { data: summary } = await runStructured({
          promptName: "evidence_summary",
          system: systemPreamble(),
          user: evidenceSummaryUserPrompt({ url: link.url, text: fetched.text, kind: "fetched" }),
          schema: EvidenceSummarySchema,
        });
        link.summaryJson = JSON.stringify(summary.bullets);
        await prisma.evidenceLink.update({
          where: { id: link.id },
          data: {
            fetchedText: clampText(fetched.text, 12000),
            summaryJson: link.summaryJson,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`Auto-summarize failed for "${link.url}":`, err);
    }
  }

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

  const hasEvidence = evidenceBullets.length > 0 || !!candidate.customData || !!candidate.notes?.trim();
  const cleaned = cleanScoringOutput(data, hasEvidence);
  const totalScore = computeTotalScore(cleaned, DEFAULT_WEIGHTS);

  await prisma.scoreCard.upsert({
    where: { candidateId: candidate.id },
    create: {
      candidateId: candidate.id,
      weightsJson: JSON.stringify(DEFAULT_WEIGHTS),
      criteriaJson: JSON.stringify(cleaned.criterionScores),
      totalScore,
      tier: "C",
      confidence: cleaned.confidence,
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
      confidence: cleaned.confidence,
      rationaleJson: JSON.stringify(cleaned.rationaleBullets),
      proofPointsJson: JSON.stringify(cleaned.proofPoints),
      flagsJson: JSON.stringify(cleaned.flags),
      disqualifiersJson: JSON.stringify(cleaned.disqualifiers),
      nextStep: cleaned.nextStep,
    },
  });
}

// Re-tier all candidates in a project (called after scoring)
async function retierProject(projectId: string) {
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
    if (ci > 0) await new Promise((r) => setTimeout(r, 1000));
    await scoreSingleCandidate(project.candidates[ci], project);
  }

  await retierProject(projectId);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/results`);
}

export async function scoreAndTierCandidatesBatchAction(projectId: string, candidateIds: string[]) {
  await requireAuth();
  if (!candidateIds.length) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      brandCategory: true, productTypeSought: true, priceRange: true,
      distributionPreference: true, geography: true, positioningKeywords: true, constraints: true,
      brandBackground: true, brandWebsite: true, brandContextText: true,
    },
  });
  if (!project) return;

  const candidates = await prisma.candidate.findMany({
    where: { id: { in: candidateIds }, projectId },
    include: { evidenceLinks: true },
  });

  for (let ci = 0; ci < candidates.length; ci++) {
    if (ci > 0) await new Promise((r) => setTimeout(r, 1000));
    await scoreSingleCandidate(candidates[ci], project);
  }

  // Re-tier the whole project so relative rankings stay correct
  await retierProject(projectId);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/candidates`);
  revalidatePath(`/projects/${projectId}/results`);
}

export async function scoreOneCandidateAction(projectId: string, candidateId: string) {
  await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      brandCategory: true, productTypeSought: true, priceRange: true,
      distributionPreference: true, geography: true, positioningKeywords: true, constraints: true,
      brandBackground: true, brandWebsite: true, brandContextText: true,
    },
  });
  if (!project) return;

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId, projectId },
    include: { evidenceLinks: true },
  });
  if (!candidate) return;

  await scoreSingleCandidate(candidate, project);

  revalidatePath(`/projects/${projectId}/candidates`);
}

export async function retierProjectAction(projectId: string) {
  await requireAuth();
  await retierProject(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/candidates`);
  revalidatePath(`/projects/${projectId}/results`);
}

export async function deleteCandidatesBatchAction(projectId: string, candidateIds: string[]) {
  await requireAuth();
  if (!candidateIds.length) return;
  await prisma.candidate.deleteMany({ where: { id: { in: candidateIds }, projectId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/candidates`);
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

export async function generateOutreachForCandidateAction(candidateId: string) {
  await requireAuth();

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { scoreCard: true, project: true },
  });
  if (!candidate || !candidate.scoreCard || !candidate.project) return;

  const proofPoints = safeJsonParseArray<{ text: string; supportType: string; url?: string | null }>(
    candidate.scoreCard.proofPointsJson
  );

  const system = systemPreamble();
  const user = outreachDraftUserPrompt({
    projectBrief: projectBrief(candidate.project),
    candidateName: candidate.name,
    candidateWebsite: candidate.website,
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
    where: { candidateId: candidate.id },
    create: {
      candidateId: candidate.id,
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
      candidateId: candidate.id,
      type: "status_change",
      payloadJson: JSON.stringify({ status: "outreach_drafted" }),
    },
  });

  revalidatePath(`/projects/${candidate.projectId}/results`);
  revalidatePath(`/projects/${candidate.projectId}`);
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
