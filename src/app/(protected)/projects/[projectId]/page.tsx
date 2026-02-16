import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  addCandidateAction,
  clearAllCandidatesAction,
  generateCandidatesAction,
  researchCandidatesAction,
  scoreAndTierProjectAction,
  updateProjectAction,
  uploadCandidatesCsvAction,
} from "@/app/(protected)/projects/actions";
import { parseExcludeList } from "@/lib/utils";
import CandidateTable from "./CandidateTable";

function completeness(p: {
  brandCategory?: string | null;
  productTypeSought?: string | null;
  priceRange?: string | null;
  distributionPreference?: string | null;
  geography?: string | null;
  positioningKeywords?: string | null;
  constraints?: string | null;
}) {
  const required = [
    { key: "brandCategory", label: "Brand category" },
    { key: "productTypeSought", label: "Product type sought" },
    { key: "priceRange", label: "Price range" },
    { key: "distributionPreference", label: "Distribution preference" },
  ] as const;

  const missing = required
    .filter((r) => !(p as any)[r.key])
    .map((r) => r.label);

  const nice = [
    { key: "geography", label: "Geography" },
    { key: "positioningKeywords", label: "Positioning keywords" },
    { key: "constraints", label: "Constraints" },
  ] as const;

  const niceMissing = nice.filter((r) => !(p as any)[r.key]).map((r) => r.label);

  const filled = required.length - missing.length;
  const score = Math.round((filled / required.length) * 100);
  return { score, missing, niceMissing };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAuth();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      candidates: {
        orderBy: { createdAt: "asc" },
        include: {
          evidenceLinks: { orderBy: { createdAt: "desc" } },
          scoreCard: true,
          outreachDraft: true,
          feedback: true,
        },
      },
    },
  });
  if (!project) return notFound();

  const comp = completeness(project);
  const exclude = parseExcludeList(project.excludeList);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Intake → candidates → research → scoring → outreach drafts.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-2 ring-1 ring-indigo-200/50">
              <span className="text-xs font-medium text-indigo-700">Completeness</span>
              <div className="h-2 w-24 rounded-full bg-indigo-200/50">
                <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${comp.score}%` }}></div>
              </div>
              <span className="text-xs font-semibold text-indigo-700">{comp.score}%</span>
            </div>
            {comp.missing.length > 0 && (
              <span className="rounded-full bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200/50">
                Missing: {comp.missing.join(", ")}
              </span>
            )}
            {comp.niceMissing.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                Optional: {comp.niceMissing.join(", ")}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <Link
            href={`/projects/${projectId}/results`}
            className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 hover:brightness-110 active:scale-[0.98]"
          >
            View results
          </Link>
          <Link href="/projects" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-indigo-50 hover:text-indigo-700">
            Back to projects
          </Link>
        </div>
      </div>

      {/* Intake */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Project intake</h2>
          <p className="text-xs text-slate-500">Never hard-block; missing inputs reduce evidence level.</p>
        </div>

        <form action={updateProjectAction.bind(null, projectId)} className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Project name</span>
            <input name="name" defaultValue={project.name} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Brand category</span>
            <input name="brandCategory" defaultValue={project.brandCategory ?? ""} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Product type sought</span>
            <input name="productTypeSought" defaultValue={project.productTypeSought ?? ""} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Price range</span>
            <input name="priceRange" defaultValue={project.priceRange ?? ""} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Distribution preference</span>
            <input
              name="distributionPreference"
              defaultValue={project.distributionPreference ?? ""}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Geography <span className="font-normal text-slate-400">(optional)</span></span>
            <input name="geography" defaultValue={project.geography ?? ""} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Positioning keywords <span className="font-normal text-slate-400">(optional)</span></span>
            <input
              name="positioningKeywords"
              defaultValue={project.positioningKeywords ?? ""}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Constraints <span className="font-normal text-slate-400">(optional)</span></span>
            <textarea
              name="constraints"
              defaultValue={project.constraints ?? ""}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              rows={3}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Exclude List <span className="font-normal text-slate-400">(one per line)</span></span>
            <textarea
              name="excludeList"
              defaultValue={project.excludeList ?? ""}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              rows={4}
            />
            <p className="mt-2 text-xs text-slate-500">
              Current exclude count: {exclude.length}. These companies will be filtered out of generated candidates.
            </p>
          </label>

          <div className="md:col-span-2 flex items-center gap-4">
            <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 hover:brightness-110 active:scale-[0.98]">
              Save intake
            </button>
            <Link
              href={`/projects/${projectId}/results`}
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
            >
              View results
            </Link>
          </div>
        </form>
      </section>

      {/* Candidate sourcing */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Candidates</h2>
            <div className="flex flex-wrap gap-2">
              <form action={generateCandidatesAction.bind(null, projectId)}>
                <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]">
                  Generate (LLM)
                </button>
              </form>
              <form action={researchCandidatesAction.bind(null, projectId)}>
                <button type="submit" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]">
                  Research
                </button>
              </form>
              <form action={scoreAndTierProjectAction.bind(null, projectId)}>
                <button type="submit" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]">
                  Score & Tier
                </button>
              </form>
              <Link
                href={`/projects/${projectId}/results`}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                Results
              </Link>
              {project.candidates.length > 0 && (
                <form action={clearAllCandidatesAction.bind(null, projectId)}>
                  <button type="submit" className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 shadow-sm transition-all duration-200 hover:border-red-300 hover:bg-red-50 active:scale-[0.98]">
                    Clear all
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="mt-5">
            <CandidateTable
              candidates={project.candidates.map((c) => ({
                id: c.id,
                name: c.name,
                website: c.website,
                notes: c.notes,
                customData: c.customData,
                provenance: c.provenance,
                evidenceLinks: c.evidenceLinks.map((l) => ({
                  id: l.id,
                  url: l.url,
                  summaryJson: l.summaryJson,
                })),
                scoreCard: c.scoreCard
                  ? { tier: c.scoreCard.tier, totalScore: c.scoreCard.totalScore }
                  : null,
              }))}
              projectId={projectId}
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Manual add</h3>
            <form action={addCandidateAction.bind(null, projectId)} className="mt-4 space-y-3">
              <input
                name="name"
                placeholder="Company name"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
              <input
                name="website"
                placeholder="Website (optional)"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <textarea
                name="notes"
                placeholder="Notes (optional)"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                rows={3}
              />
              <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]">
                Add
              </button>
              <p className="text-xs text-slate-500">Exclude List is applied automatically.</p>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Upload CSV</h3>
            <p className="mt-2 text-xs text-slate-500">Columns: name/company (required). Any additional columns (website, notes, links, or anything else) will be preserved and used in scoring.</p>
            <form action={uploadCandidatesCsvAction.bind(null, projectId)} className="mt-4 space-y-3">
              <input type="file" name="file" accept=".csv,text/csv" className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100" required />
              <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]">
                Upload
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-xs text-amber-900 shadow-sm">
            <p className="font-semibold">Scoring reminder</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Category + distribution weights = 60%</li>
              <li>Licensing activity weight = 20%</li>
              <li>Everything else combined = 20%</li>
              <li>Category or distribution disqualifiers zero out that pillar (max ~40% score)</li>
              <li>Hard disqualifiers automatically lock candidates into C-tier</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
