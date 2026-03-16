import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { deleteProjectDocumentAction } from "@/app/(protected)/projects/actions";
import ActionButton from "@/components/ActionButton";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800 break-all">{value || <span className="italic text-slate-400">—</span>}</p>
    </div>
  );
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAuth();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      documents: { orderBy: { createdAt: "asc" } },
      candidates: { select: { id: true, provenance: true } },
    },
  });
  if (!project) return notFound();

  const totalCandidates = project.candidates.length;
  const byProvenance = {
    uploaded: project.candidates.filter((c) => c.provenance === "uploaded").length,
    generated: project.candidates.filter((c) => c.provenance === "generated").length,
    manual: project.candidates.filter((c) => c.provenance === "manual").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Project overview — review your setup before running research and scoring.</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Link
            href={`/projects/${projectId}/candidates`}
            className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]"
          >
            Continue →
          </Link>
          <Link
            href={`/projects/${projectId}/results`}
            className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            View results
          </Link>
          <Link href="/projects" className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
            Back to projects
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Intake summary */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Project intake</h2>
            <Link
              href={`/projects/${projectId}/edit`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              Edit intake
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Brand category" value={project.brandCategory} />
            <Field label="Brand website" value={project.brandWebsite} />
            <div className="sm:col-span-2">
              <Field label="Brand background" value={project.brandBackground} />
            </div>
            <Field label="Product types sought" value={project.productTypeSought} />
            <Field label="Price range" value={project.priceRange} />
            <div className="sm:col-span-2">
              <Field label="Distribution preference" value={project.distributionPreference} />
            </div>
            <Field label="Geography" value={project.geography} />
            <Field label="Positioning keywords" value={project.positioningKeywords} />
            <div className="sm:col-span-2">
              <Field label="Constraints" value={project.constraints} />
            </div>
            {project.excludeList && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Exclude list</p>
                <p className="mt-1 text-sm text-slate-800">
                  {project.excludeList.split("\n").filter(Boolean).length} entries
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="space-y-6">
          {/* Brand documents */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Brand documents</h2>
              <Link
                href={`/projects/${projectId}/setup?next=/projects/${projectId}`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all duration-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
              >
                + Add more
              </Link>
            </div>
            {project.documents.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400 italic">No documents uploaded. <Link href={`/projects/${projectId}/setup?next=/projects/${projectId}`} className="text-violet-600 hover:underline not-italic">Upload one →</Link></p>
            ) : (
              <ul className="mt-4 space-y-2">
                {project.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5">
                    <svg className="h-4 w-4 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate text-sm text-slate-700">{doc.filename}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-400">
                      {doc.extractedText.length.toLocaleString()} chars
                    </span>
                    <ActionButton
                      action={deleteProjectDocumentAction.bind(null, doc.id)}
                      label="Remove"
                      pendingLabel="…"
                      className="shrink-0 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    />
                  </li>
                ))}
              </ul>
            )}
            {project.brandContextText && (
              <p className="mt-3 text-xs text-slate-400">
                {project.brandContextText.length.toLocaleString()} chars of context injected into LLM prompts.
              </p>
            )}
          </section>

          {/* Candidates summary */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Candidates</h2>
              <Link
                href={`/projects/${projectId}/candidates`}
                className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110"
              >
                Continue →
              </Link>
            </div>
            <div className="mt-4">
              {totalCandidates === 0 ? (
                <p className="text-sm text-slate-400 italic">No candidates yet.</p>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">{totalCandidates}</span>
                  <span className="text-sm text-slate-500">total candidates</span>
                </div>
              )}
              {totalCandidates > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {byProvenance.uploaded > 0 && (
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200/50">
                      {byProvenance.uploaded} uploaded
                    </span>
                  )}
                  {byProvenance.generated > 0 && (
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200/50">
                      {byProvenance.generated} generated
                    </span>
                  )}
                  {byProvenance.manual > 0 && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {byProvenance.manual} manual
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Link
                href={`/projects/${projectId}/setup/manual?next=/projects/${projectId}`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                + Manual add
              </Link>
              <Link
                href={`/projects/${projectId}/setup/candidates?next=/projects/${projectId}`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                + Upload list
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
