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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Intake → candidates → scoring → outreach drafts. No search API in v0.1.
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
          <p className="text-xs text-slate-500">Never hard-block; missing inputs reduce confidence.</p>
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
              Current exclude count: {exclude.length}. Used as heuristic for "not on exhibitor list" in v0.1.
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
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200/80">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Company</th>
                  <th className="px-4 py-3 text-left font-semibold">Provenance</th>
                  <th className="px-4 py-3 text-left font-semibold">Tier</th>
                  <th className="px-4 py-3 text-left font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {project.candidates.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                      No candidates yet. Generate or upload a CSV.
                    </td>
                  </tr>
                ) : (
                  project.candidates.map((c) => (
                    <tr id={`candidate-${c.id}`} key={c.id} className="border-t border-slate-100 align-top transition-colors duration-200 hover:bg-indigo-50/50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{c.name}</div>
                        {c.website && (
                          <a className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline" href={c.website} target="_blank" rel="noreferrer">
                            {c.website}
                          </a>
                        )}
                        {c.notes && <div className="mt-1 text-xs text-slate-500">{c.notes}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{c.provenance}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          c.scoreCard?.tier === 'A' ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 ring-1 ring-emerald-200' :
                          c.scoreCard?.tier === 'B' ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 ring-1 ring-amber-200' :
                          c.scoreCard?.tier === 'C' ? 'bg-slate-100 text-slate-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {c.scoreCard?.tier ?? "—"}
                        </span>
                        {c.scoreCard && (
                          <div className="mt-1 text-xs text-slate-500">Score: {c.scoreCard.totalScore}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="text-xs text-slate-500">Links: {c.evidenceLinks.length}</div>
                          {c.evidenceLinks.length ? (
                            <ul className="space-y-1 text-xs">
                              {c.evidenceLinks.slice(0, 3).map((l) => (
                                <li key={l.id} className="flex items-center justify-between gap-2">
                                  <a href={l.url} target="_blank" rel="noreferrer" className="truncate text-indigo-600 hover:text-indigo-800 hover:underline">
                                    {l.url}
                                  </a>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${l.summaryJson ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {l.summaryJson ? "summarized" : "pending"}
                                  </span>
                                </li>
                              ))}
                              {c.evidenceLinks.length > 3 ? (
                                <li className="text-[11px] text-slate-400">+{c.evidenceLinks.length - 3} more…</li>
                              ) : null}
                            </ul>
                          ) : null}
                          <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                            <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                              Add evidence link / excerpt
                            </summary>
                            <form action={addEvidenceLinkAction.bind(null, c.id)} className="mt-3 space-y-3">
                              <input
                                name="url"
                                placeholder="https://..."
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                required
                              />
                              <textarea
                                name="excerpt"
                                placeholder="Optional: paste a short excerpt (if the URL won't fetch)"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                rows={3}
                              />
                              <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98]">
                                Save & summarize
                              </button>
                              <p className="text-[11px] text-slate-400">
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
            <p className="mt-2 text-xs text-slate-500">Columns: name, website (optional), notes (optional)</p>
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
              <li>Disqualifiers demote out of A-tier</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
