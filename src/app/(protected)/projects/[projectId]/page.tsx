import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  addCandidateAction,
  addEvidenceLinkAction,
  generateCandidatesAction,
  scoreAndTierProjectAction,
  updateProjectAction,
  uploadCandidatesCsvAction,
} from "@/app/(protected)/projects/actions";
import { parseExcludeList } from "@/lib/utils";

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
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Intake → candidates → scoring → outreach drafts. No search API in v0.1.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
              Completeness: {comp.score}%
            </span>
            {comp.missing.length > 0 && (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">
                Missing: {comp.missing.join(", ")}
              </span>
            )}
            {comp.niceMissing.length > 0 && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                Optional: {comp.niceMissing.join(", ")}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Link
            href={`/projects/${projectId}/results`}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            View results
          </Link>
          <Link href="/projects" className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
            Back to projects
          </Link>
        </div>
      </div>

      {/* Intake */}
      <section className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Project intake</h2>
          <p className="text-xs text-slate-500">Never hard-block; missing inputs reduce confidence.</p>
        </div>

        <form action={updateProjectAction.bind(null, projectId)} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Project name</span>
            <input name="name" defaultValue={project.name} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Brand category</span>
            <input name="brandCategory" defaultValue={project.brandCategory ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Product type sought</span>
            <input name="productTypeSought" defaultValue={project.productTypeSought ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Price range</span>
            <input name="priceRange" defaultValue={project.priceRange ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Distribution preference</span>
            <input
              name="distributionPreference"
              defaultValue={project.distributionPreference ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Geography (optional)</span>
            <input name="geography" defaultValue={project.geography ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Positioning keywords (optional)</span>
            <input
              name="positioningKeywords"
              defaultValue={project.positioningKeywords ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Constraints (optional)</span>
            <textarea
              name="constraints"
              defaultValue={project.constraints ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={3}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Exclude List (one per line)</span>
            <textarea
              name="excludeList"
              defaultValue={project.excludeList ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={4}
            />
            <p className="mt-1 text-xs text-slate-500">
              Current exclude count: {exclude.length}. Used as heuristic for "not on exhibitor list" in v0.1.
            </p>
          </label>

          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Save intake
            </button>
            <Link
              href={`/projects/${projectId}/results`}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              View results
            </Link>
          </div>
        </form>
      </section>

      {/* Candidate sourcing */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Candidates</h2>
            <div className="flex flex-wrap gap-2">
              <form action={generateCandidatesAction.bind(null, projectId)}>
                <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                  Generate (LLM)
                </button>
              </form>
              <form action={scoreAndTierProjectAction.bind(null, projectId)}>
                <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                  Score & Tier
                </button>
              </form>
              <Link
                href={`/projects/${projectId}/results`}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
              >
                Results
              </Link>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Company</th>
                  <th className="px-4 py-2 text-left font-semibold">Provenance</th>
                  <th className="px-4 py-2 text-left font-semibold">Tier</th>
                  <th className="px-4 py-2 text-left font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {project.candidates.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={4}>
                      No candidates yet. Generate or upload a CSV.
                    </td>
                  </tr>
                ) : (
                  project.candidates.map((c) => (
                    <tr id={`candidate-${c.id}`} key={c.id} className="border-t border-slate-200 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{c.name}</div>
                        {c.website && (
                          <a className="text-xs text-slate-600 hover:underline" href={c.website} target="_blank" rel="noreferrer">
                            {c.website}
                          </a>
                        )}
                        {c.notes && <div className="mt-1 text-xs text-slate-600">{c.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{c.provenance}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {c.scoreCard?.tier ?? "—"}
                        </span>
                        {c.scoreCard && (
                          <div className="mt-1 text-xs text-slate-600">Score: {c.scoreCard.totalScore}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <div className="text-xs text-slate-600">Links: {c.evidenceLinks.length}</div>
                          {c.evidenceLinks.length ? (
                            <ul className="space-y-1 text-xs text-slate-600">
                              {c.evidenceLinks.slice(0, 3).map((l) => (
                                <li key={l.id} className="flex items-center justify-between gap-2">
                                  <a href={l.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                                    {l.url}
                                  </a>
                                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
                                    {l.summaryJson ? "summarized" : "pending"}
                                  </span>
                                </li>
                              ))}
                              {c.evidenceLinks.length > 3 ? (
                                <li className="text-[11px] text-slate-500">+{c.evidenceLinks.length - 3} more…</li>
                              ) : null}
                            </ul>
                          ) : null}
                          <details className="rounded-md border border-slate-200 p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                              Add evidence link / excerpt
                            </summary>
                            <form action={addEvidenceLinkAction.bind(null, c.id)} className="mt-2 space-y-2">
                              <input
                                name="url"
                                placeholder="https://..."
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                                required
                              />
                              <textarea
                                name="excerpt"
                                placeholder="Optional: paste a short excerpt (if the URL won't fetch)"
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                                rows={3}
                              />
                              <button type="submit" className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                                Save & summarize
                              </button>
                              <p className="text-[11px] text-slate-500">
                                We only fetch public URLs. No scraping behind logins. If fetch fails, paste an excerpt.
                              </p>
                            </form>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Manual add</h3>
            <form action={addCandidateAction.bind(null, projectId)} className="mt-3 space-y-2">
              <input
                name="name"
                placeholder="Company name"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <input
                name="website"
                placeholder="Website (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                name="notes"
                placeholder="Notes (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={3}
              />
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Add
              </button>
              <p className="text-xs text-slate-500">Exclude List is applied automatically.</p>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Upload CSV</h3>
            <p className="mt-1 text-xs text-slate-600">Columns: name, website (optional), notes (optional)</p>
            <form action={uploadCandidatesCsvAction.bind(null, projectId)} className="mt-3 space-y-2">
              <input type="file" name="file" accept=".csv,text/csv" className="w-full text-sm" required />
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Upload
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-semibold">Scoring reminder</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Category + distribution weights = 60%</li>
              <li>Licensing activity weight = 20%</li>
              <li>Everything else combined = 20%</li>
              <li>Disqualifiers demote out of A-tier</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
