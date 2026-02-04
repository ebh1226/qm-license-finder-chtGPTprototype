import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { toScoreCardView } from "@/lib/db";
import {
  generateOutreachForATierAction,
  saveCandidateFeedbackAction,
  saveProjectFeedbackAction,
  scoreAndTierProjectAction,
} from "@/app/(protected)/projects/actions";

function Badge({ tone, children }: { tone: "green" | "amber" | "slate"; children: React.ReactNode }) {
  const colors = {
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[tone]}`}>{children}</span>;
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

  const tiers = {
    A: candidates.filter((c) => c.score?.tier === "A"),
    B: candidates.filter((c) => c.score?.tier === "B"),
    C: candidates.filter((c) => c.score?.tier === "C"),
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
          <p className="mt-1 text-sm text-slate-600">
            A-tier (3–5) is intended to be client-ready. B-tier (5–7) are good fits missing an element. C-tier are wildcards.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={scoreAndTierProjectAction.bind(null, projectId)}>
            <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
              Re-score & tier
            </button>
          </form>
          <form action={generateOutreachForATierAction.bind(null, projectId)}>
            <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              Generate outreach for A-tier
            </button>
          </form>
          <a
            href={`/api/projects/${projectId}/export.csv`}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
          >
            Export CSV
          </a>
          <Link
            href={`/projects/${projectId}/report`}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
          >
            Printable report
          </Link>
          <Link href={`/projects/${projectId}`} className="rounded-md px-2 py-1 text-xs hover:bg-slate-100">
            Back
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold">Confidence + sourcing labels</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
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
        <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-600">
          No scored candidates yet. Go back to the project page and click <span className="font-semibold">Score & Tier</span>.
        </div>
      ) : (
        <div className="space-y-8">
          <TierSection title="A-tier" tone="green" items={tiers.A} projectId={projectId} />
          <TierSection title="B-tier" tone="amber" items={tiers.B} projectId={projectId} />
          <TierSection title="C-tier" tone="slate" items={tiers.C} projectId={projectId} />
        </div>
      )}

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Feedback</h2>
        <p className="mt-1 text-xs text-slate-600">
          Stored in the database so MAP can iterate on prompts and scoring logic.
        </p>
        <form action={saveProjectFeedbackAction.bind(null, projectId)} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Was A-tier useful?</span>
            <select
              name="rating"
              defaultValue={project.feedback?.rating?.toString() ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            <span className="text-xs font-medium text-slate-700">Notes</span>
            <input
              name="notes"
              defaultValue={project.feedback?.notes ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="What was off? What should we improve?"
            />
          </label>
          <div className="md:col-span-3">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Save feedback
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TierSection({
  title,
  tone,
  items,
  projectId,
}: {
  title: string;
  tone: "green" | "amber" | "slate";
  items: Array<any>;
  projectId: string;
}) {
  const headerTone =
    tone === "green" ? "border-green-200 bg-green-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50";

  return (
    <section className="space-y-3">
      <div className={`rounded-xl border px-4 py-3 ${headerTone}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <span className="text-xs text-slate-600">{items.length} companies</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">None yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((c) => (
            <CandidateCard key={c.id} c={c} projectId={projectId} />
          ))}
        </div>
      )}
    </section>
  );
}

function CandidateCard({ c, projectId }: { c: any; projectId: string }) {
  const score = c.score;
  const confidence = score?.confidence as "High" | "Medium" | undefined;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{c.name}</h3>
            {score?.tier === "A" && <Badge tone="green">A</Badge>}
            {score?.tier === "B" && <Badge tone="amber">B</Badge>}
            {score?.tier === "C" && <Badge tone="slate">C</Badge>}
            {confidence === "High" ? <Badge tone="green">Confidence: High</Badge> : <Badge tone="amber">Confidence: Medium</Badge>}
            <Badge tone="slate">Score: {score?.totalScore}</Badge>
          </div>
          {c.website && (
            <a href={c.website} target="_blank" rel="noreferrer" className="text-xs text-slate-600 hover:underline">
              {c.website}
            </a>
          )}
          <div className="mt-2 text-sm text-slate-700">
            <ul className="list-disc space-y-1 pl-5">
              {(score?.rationaleBullets ?? []).map((b: string, i: number) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href={`/projects/${projectId}#candidate-${c.id}`}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
          >
            Evidence
          </Link>
          {c.outreachDraft ? (
            <Badge tone="green">Outreach ready</Badge>
          ) : (
            <Badge tone="slate">No outreach draft</Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-800">Proof points</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {(score?.proofPoints ?? []).map((p: any, i: number) => (
              <li key={i}>
                {p.text} {p.supportType ? <span className="ml-1 text-xs text-slate-500">({p.supportType})</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-800">Flags & disqualifiers</h4>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            {score?.flags?.length ? (
              <div>
                <div className="text-xs font-semibold text-slate-700">Flags</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {score.flags.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-xs text-slate-500">No flags.</div>
            )}

            {score?.disqualifiers?.length ? (
              <div>
                <div className="text-xs font-semibold text-slate-700">Disqualifiers</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {score.disqualifiers.map((d: string, i: number) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <div className="text-xs font-semibold text-slate-700">Next step</div>
              <div className="mt-1">{score?.nextStep}</div>
            </div>
          </div>
        </div>
      </div>

      {c.outreachDraft ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-800">Outreach draft (no sending)</summary>
          <div className="mt-3 space-y-2">
            <div className="text-xs text-slate-500">Subject</div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">{c.outreachDraft.subject}</div>
            <div className="text-xs text-slate-500">Body</div>
            <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">{c.outreachDraft.body}</pre>
          </div>
        </details>
      ) : null}

      <details className="mt-4 rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-800">Candidate feedback</summary>
        <form action={saveCandidateFeedbackAction.bind(null, c.id)} className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input name="misfit" type="checkbox" defaultChecked={!!c.feedback?.misfit} />
            Mark as misfit
          </label>
          <input
            name="reason"
            defaultValue={c.feedback?.reason ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Reason (optional)"
          />
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Save
          </button>
        </form>
      </details>
    </div>
  );
}
