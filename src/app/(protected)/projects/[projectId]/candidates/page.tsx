import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  generateCandidatesAction,
  researchCandidatesBatchAction,
  scoreAndTierCandidatesBatchAction,
  clearAllCandidatesAction,
  addCandidateAction,
  uploadCandidatesCsvAction,
  uploadBrandDocumentAction,
} from "@/app/(protected)/projects/actions";
import ActionButton from "@/components/ActionButton";
import SubmitButton from "@/components/SubmitButton";
import CandidateTable from "../CandidateTable";
import CandidatesBulkUploader from "./CandidatesBulkUploader";

export default async function CandidatesPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAuth();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      candidates: {
        orderBy: { createdAt: "asc" },
        include: {
          evidenceLinks: { orderBy: { createdAt: "asc" } },
          scoreCard: { select: { tier: true, totalScore: true } },
        },
      },
    },
  });
  if (!project) return notFound();

  const allIds = project.candidates.map((c) => c.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Candidates</h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{project.name}</span> — manage, research, and score license candidates.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/projects/${projectId}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            ← Back to project info
          </Link>
          <Link
            href={`/projects/${projectId}/results`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            View results
          </Link>
          
        </div>
      </div>

      {/* Action toolbar */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <ActionButton
          action={generateCandidatesAction.bind(null, projectId)}
          label="1. Generate candidates (LLM)"
          pendingLabel="Generating…"
          className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        />
        <ActionButton
          action={researchCandidatesBatchAction.bind(null, projectId, allIds)}
          label="2. Research all"
          pendingLabel="Researching…"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] disabled:opacity-50"
        />
        <ActionButton
          action={scoreAndTierCandidatesBatchAction.bind(null, projectId, allIds)}
          label="3. Score & tier all"
          pendingLabel="Scoring…"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] disabled:opacity-50"
        />
        <div className="ml-auto">
          <ActionButton
            action={clearAllCandidatesAction.bind(null, projectId)}
            label="Clear all"
            pendingLabel="Clearing…"
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-500 shadow-sm transition-all duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700 active:scale-[0.98] disabled:opacity-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Candidate table */}
        <div className="min-w-0">
          <CandidateTable candidates={project.candidates} projectId={projectId} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Manual add */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Add manually</h2>
            <form action={addCandidateAction.bind(null, projectId)} className="mt-3 space-y-2">
              <input
                name="name"
                placeholder="Company name"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <input
                name="website"
                placeholder="Website (optional)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <textarea
                name="notes"
                placeholder="Notes (optional)"
                rows={2}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <SubmitButton
                label="Add candidate"
                pendingLabel="Adding…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] disabled:opacity-50"
              />
            </form>
          </section>

          {/* Upload candidate list */}
          <CandidatesBulkUploader projectId={projectId} actionLabel="Upload candidate list (.csv/.xlsx)" uploadAction={uploadCandidatesCsvAction} />

          {/* Upload brand document */}
          <CandidatesBulkUploader projectId={projectId} actionLabel="Upload brand document (.pdf/.docx/…)" uploadAction={uploadBrandDocumentAction} accept=".pdf,.pptx,.ppt,.docx,.txt" />
        </div>
      </div>
    </div>
  );
}
