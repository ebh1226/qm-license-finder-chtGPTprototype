import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { safeParseJson } from "@/lib/db";
import { toCsv } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const user = await getAuthUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, ownerId: user.id },
    select: { id: true, name: true },
  });
  if (!project) {
    return new NextResponse("Not found", { status: 404 });
  }

  const candidates = await prisma.candidate.findMany({
    where: { projectId: project.id },
    include: { scoreCard: true, outreachDraft: true },
  });

  const rows = candidates
    .filter((c) => c.scoreCard)
    .sort((a, b) => (b.scoreCard?.totalScore ?? 0) - (a.scoreCard?.totalScore ?? 0))
    .map((c) => {
      const sc = c.scoreCard!;
      const rationale = safeParseJson<string[]>(sc.rationaleJson, []).join(" | ");
      const proof = safeParseJson<any[]>(sc.proofPointsJson, [])
        .map((p) => `${p.text} (${p.supportType})`)
        .join(" | ");
      const flags = safeParseJson<string[]>(sc.flagsJson, []).join(" | ");
      const disq = safeParseJson<string[]>(sc.disqualifiersJson, []).join(" | ");

      return {
        tier: sc.tier,
        totalScore: sc.totalScore,
        confidence: sc.confidence,
        companyName: c.name,
        website: c.website ?? "",
        provenance: c.provenance,
        rationaleBullets: rationale,
        proofPoints: proof,
        flags,
        disqualifiers: disq,
        nextStep: sc.nextStep,
        outreachSubject: c.outreachDraft?.subject ?? "",
      };
    });

  const csv = toCsv(rows);
  const filename = `qm-license-finder-${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${project.id.slice(0, 6)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
