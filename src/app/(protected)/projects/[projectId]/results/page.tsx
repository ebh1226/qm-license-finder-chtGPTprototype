import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { toScoreCardView } from "@/lib/db";
import SubmitButton from "@/components/SubmitButton";
import ActionButton from "@/components/ActionButton";
import {
  generateOutreachForATierAction,
  saveProjectFeedbackAction,
  scoreAndTierProjectAction,
} from "@/app/(protected)/projects/actions";
import ResultsGroupingView from "./ResultsGroupingView";

function Badge({ tone, children }: { tone: "green" | "amber" | "slate" | "red"; children: React.ReactNode }) {
  const colors = {
    green: "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 ring-1 ring-emerald-200/50",
    amber: "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 ring-1 ring-amber-200/50",
    red: "bg-gradient-to-r from-red-50 to-rose-50 text-red-700 ring-1 ring-red-200/50",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[tone]}`}>{children}</span>;
}

export default async function ResultsPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAuth();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      feedback: true,
      candidates: {
        include: { scoreCard: true, outreachDraft: true, feedback: true, evidenceLinks: true },
      },
    },
  });
  if (!project) return notFound();

  const candidates = project.candidates
    .filter((c) => c.scoreCard)
    .map((c) => ({
      ...c,
      score: c.scoreCard ? toScoreCardView(c.scoreCard) : null,
    }))
    .sort((a, b) => (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Results</h1>
          <p className="mt-2 text-sm text-slate-600">
            A-tier (3–5) is intended to be client-ready. B-tier (5–7) are good fits missing an element. C-tier are wildcards.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton action={scoreAndTierProjectAction.bind(null, projectId)} label="Re-score & tier" pendingLabel="Scoring…" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] disabled:opacity-50" />
          <ActionButton action={generateOutreachForATierAction.bind(null, projectId)} label="Generate outreach for A-tier" pendingLabel="Generating outreach…" className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50" />
          <a
            href={`/api/projects/${projectId}/export.csv`}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            Export CSV
          </a>
          <Link
            href={`/projects/${projectId}/report`}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            Printable report
          </Link>
          <Link href={`/projects/${projectId}`} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-colors duration-200 hover:bg-indigo-50 hover:text-indigo-700">
            Back
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 text-sm text-indigo-900 shadow-sm">
        <p className="font-semibold">Evidence level + sourcing labels</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <Badge tone="green">link_supported</Badge> = derived from a user-provided public URL that successfully fetched and was summarized.
          </li>
          <li>
            <Badge tone="amber">to_verify</Badge> = suggested proof points to confirm manually; not asserted as fact.
          </li>
          <li>
            <Badge tone="slate">assumed</Badge> = inference based on generic category knowledge; treat as a hypothesis.
          </li>
        </ul>
      </div>

      {project.candidates.length === 0 || candidates.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No scored candidates yet. Go back to the project page and click <span className="font-semibold text-indigo-600">Score & Tier</span>.
        </div>
      ) : (
        <ResultsGroupingView candidates={candidates} projectId={projectId} />
      )}

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Feedback</h2>
        <p className="mt-2 text-xs text-slate-500">
          Stored in the database so MAP can iterate on prompts and scoring logic.
        </p>
        <form action={saveProjectFeedbackAction.bind(null, projectId)} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Was A-tier useful?</span>
            <select
              name="rating"
              defaultValue={project.feedback?.rating?.toString() ?? ""}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">(not set)</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <input
              name="notes"
              defaultValue={project.feedback?.notes ?? ""}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="What was off? What should we improve?"
            />
          </label>
          <div className="md:col-span-3">
            <SubmitButton label="Save feedback" pendingLabel="Saving…" className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50" />
          </div>
        </form>
      </section>
    </div>
  );
}
