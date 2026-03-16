import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addCandidateAction } from "@/app/(protected)/projects/actions";
import SubmitButton from "@/components/SubmitButton";

export default async function SetupManualPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  await requireAuth();
  const { projectId } = await params;
  const { next } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      candidates: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, provenance: true } },
    },
  });
  if (!project) return notFound();

  const nextUrl = next ?? `/projects/${projectId}`;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span className="text-xs text-slate-400">Brand docs</span>
          </div>
          <div className="h-px w-6 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span className="text-xs text-slate-400">Candidate list</span>
          </div>
          <div className="h-px w-6 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">3</span>
            <span className="text-xs font-medium text-indigo-700">Manual add</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-200/80">
            <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Add candidates manually</h1>
          <p className="mt-1 text-sm text-slate-500"><span className="font-medium text-slate-700">{project.name}</span></p>
        </div>

        {/* Add form */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Do you have specific companies you want to include? Add them one at a time below. The exclude list is applied automatically.
          </p>
          <p className="mt-1 text-xs text-slate-400">This step is optional — you can also generate candidates using the LLM on the next page.</p>

          <form action={addCandidateAction.bind(null, projectId)} className="mt-5 space-y-3">
            <input
              name="name"
              placeholder="Company name"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <input
              name="website"
              placeholder="Website (optional)"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <textarea
              name="notes"
              placeholder="Notes (optional)"
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <SubmitButton
              label="Add candidate"
              pendingLabel="Adding…"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] disabled:opacity-50"
            />
          </form>

          {/* Current candidates list */}
          {project.candidates.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Added so far ({project.candidates.length})
              </p>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {project.candidates.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <svg className="h-3.5 w-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-400">{c.provenance}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Continue */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">You can add more candidates anytime from the project page.</p>
          <Link
            href={nextUrl}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]"
          >
            Continue
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
