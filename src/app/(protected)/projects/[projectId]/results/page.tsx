import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { safeParseJson, toScoreCardView } from "@/lib/db";
import {
  generateOutreachForATierAction,
  generateOutreachForCandidateAction,
  saveCandidateFeedbackAction,
  saveProjectFeedbackAction,
  scoreAndTierProjectAction,
} from "@/app/(protected)/projects/actions";

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

  const tiers = {
    A: candidates.filter((c) => c.score?.tier === "A"),
    B: candidates.filter((c) => c.score?.tier === "B"),
    C: candidates.filter((c) => c.score?.tier === "C"),
  };

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
          <form action={scoreAndTierProjectAction.bind(null, projectId)}>
            <button type="submit" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]">
              Re-score & tier
            </button>
          </form>
          <form action={generateOutreachForATierAction.bind(null, projectId)}>
            <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]">
              Generate outreach for A-tier
            </button>
          </form>
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
        <div className="space-y-8">
          <TierSection title="A-tier" tone="green" items={tiers.A} projectId={projectId} />
          <TierSection title="B-tier" tone="amber" items={tiers.B} projectId={projectId} />
          <TierSection title="C-tier" tone="slate" items={tiers.C} projectId={projectId} />
        </div>
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
            <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]">
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
    tone === "green" ? "border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-green-50" :
    tone === "amber" ? "border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50" :
    "border-slate-200/80 bg-gradient-to-r from-slate-50 to-slate-100";

  return (
    <section className="space-y-4">
      <div className={`rounded-2xl border px-5 py-4 shadow-sm ${headerTone}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">{items.length} companies</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">None yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
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
  const confidence = score?.confidence as "High" | "Medium" | "Low" | undefined;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{c.name}</h3>
            {score?.tier === "A" && <Badge tone="green">A</Badge>}
            {score?.tier === "B" && <Badge tone="amber">B</Badge>}
            {score?.tier === "C" && <Badge tone="slate">C</Badge>}
            {confidence === "High" ? <Badge tone="green">Evidence: High</Badge> : confidence === "Low" ? <Badge tone="red">Evidence: Low</Badge> : <Badge tone="amber">Evidence: Medium</Badge>}
            <Badge tone="slate">Score: {score?.totalScore}</Badge>
          </div>
          {c.website && (
            <a href={c.website} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-indigo-600 hover:text-indigo-800 hover:underline">
              {c.website}
            </a>
          )}
          <div className="mt-3 text-sm text-slate-700">
            <ul className="list-disc space-y-1.5 pl-5">
              {(score?.rationaleBullets ?? []).map((b: string, i: number) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          {c.outreachDraft ? (
            <Badge tone="green">Outreach ready</Badge>
          ) : (
            <form action={generateOutreachForCandidateAction.bind(null, c.id)}>
              <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98]">
                Generate outreach
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50/50 p-4">
          <h4 className="text-sm font-semibold text-slate-800">Proof points</h4>
          <div className="mt-3 space-y-4 text-sm text-slate-700">
            {(() => {
              const points = score?.proofPoints ?? [];
              const linkSupported = points.filter((p: any) => p.supportType === "link_supported");
              const toVerify = points.filter((p: any) => p.supportType === "to_verify");
              const other = points.filter((p: any) => p.supportType !== "link_supported" && p.supportType !== "to_verify");
              return (
                <>
                  {linkSupported.length > 0 && (
                    <div>
                      <Badge tone="green">link_supported</Badge>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5">
                        {linkSupported.map((p: any, i: number) => (
                          <li key={i}>{p.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {toVerify.length > 0 && (
                    <div>
                      <Badge tone="amber">to_verify</Badge>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5">
                        {toVerify.map((p: any, i: number) => (
                          <li key={i}>{p.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {other.length > 0 && (
                    <div>
                      <Badge tone="slate">assumed</Badge>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5">
                        {other.map((p: any, i: number) => (
                          <li key={i}>{p.text}{p.supportType ? <span className="ml-1 text-xs text-slate-400">({p.supportType})</span> : null}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50/50 p-4">
          <h4 className="text-sm font-semibold text-slate-800">Flags & disqualifiers</h4>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            {score?.flags?.length ? (
              <div>
                <div className="text-xs font-semibold text-slate-600">Flags</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {score.flags.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-xs text-slate-400">No flags.</div>
            )}

            {score?.disqualifiers?.length ? (
              <div>
                <div className="text-xs font-semibold text-slate-600">Disqualifiers</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {score.disqualifiers.map((d: string, i: number) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <div className="text-xs font-semibold text-slate-600">Next step</div>
              <div className="mt-1">{score?.nextStep}</div>
            </div>
          </div>
        </div>
      </div>

      <EvidenceDetail c={c} score={score} />

      {c.outreachDraft ? (
        <details className="mt-6 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 to-violet-50/50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-indigo-700 hover:text-indigo-800">Outreach draft (no sending)</summary>
          <div className="mt-4 space-y-3">
            <div className="text-xs font-medium text-slate-500">Subject</div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">{c.outreachDraft.subject}</div>
            <div className="text-xs font-medium text-slate-500">Body</div>
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">{c.outreachDraft.body}</pre>
          </div>
        </details>
      ) : null}

      <details className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">Candidate feedback</summary>
        <form action={saveCandidateFeedbackAction.bind(null, c.id)} className="mt-4 space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input name="misfit" type="checkbox" defaultChecked={!!c.feedback?.misfit} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Mark as misfit
          </label>
          <input
            name="reason"
            defaultValue={c.feedback?.reason ?? ""}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Reason (optional)"
          />
          <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98]">
            Save
          </button>
        </form>
      </details>
    </div>
  );
}

const CRITERION_LABELS: Record<string, string> = {
  categoryFit: "Category Fit",
  distributionAlignment: "Distribution Alignment",
  licensingActivity: "Licensing Activity",
  scaleAppropriateness: "Scale Appropriateness",
  qualityReputation: "Quality & Reputation",
  geoCoverage: "Geo Coverage",
  recentMomentum: "Recent Momentum",
  manufacturingCapability: "Manufacturing Capability",
};

function EvidenceDetail({ c, score }: { c: any; score: any }) {
  const criteria = (score?.criteria ?? {}) as Record<string, number>;
  const evidenceLinks: Array<{ url: string; excerpt?: string | null; fetchedText?: string | null; summaryJson?: string | null }> = c.evidenceLinks ?? [];
  const customData = c.customData ? (() => { try { return JSON.parse(c.customData) as Record<string, string>; } catch { return null; } })() : null;

  return (
    <details className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">Evidence & scoring inputs</summary>
      <div className="mt-4 space-y-5">

        {/* Criterion score breakdown */}
        <div>
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Score breakdown</div>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
            {Object.entries(CRITERION_LABELS).map(([key, label]) => {
              const val = criteria[key] as number | undefined;
              return (
                <div key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-semibold text-slate-900">{val ?? "–"}<span className="text-slate-400 font-normal">/5</span></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Candidate notes */}
        {c.notes?.trim() && (
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Candidate notes</div>
            <p className="mt-1 text-sm text-slate-700">{c.notes}</p>
          </div>
        )}

        {/* Custom data (extra CSV columns) */}
        {customData && Object.keys(customData).length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">User-provided data</div>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 text-sm">
              {Object.entries(customData).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="text-slate-500 font-medium">{key}:</dt>
                  <dd className="text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Evidence links */}
        {evidenceLinks.length > 0 ? (
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Evidence sources ({evidenceLinks.length})</div>
            <div className="mt-2 space-y-3">
              {evidenceLinks.map((el, i) => {
                const summaryBullets = safeParseJson<Array<{ text: string; supportType: string }>>(el.summaryJson, []);
                return (
                  <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <a href={el.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline break-all">{el.url}</a>
                    {el.excerpt && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-slate-500">User excerpt:</span>
                        <p className="mt-0.5 text-slate-700 italic">{el.excerpt}</p>
                      </div>
                    )}
                    {summaryBullets.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                        {summaryBullets.map((b, j) => (
                          <li key={j}>{b.text}</li>
                        ))}
                      </ul>
                    )}
                    {!el.excerpt && summaryBullets.length === 0 && el.fetchedText && (
                      <p className="mt-1 text-xs text-slate-400">Fetched content available (used during scoring)</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Evidence sources</div>
            <p className="mt-1 text-sm text-slate-400">No evidence links were provided for this candidate.</p>
          </div>
        )}
      </div>
    </details>
  );
}
