"use client";

import { useState, useMemo } from "react";
import ActionButton from "@/components/ActionButton";
import SubmitButton from "@/components/SubmitButton";
import { safeParseJson } from "@/lib/db";
import {
  generateOutreachForCandidateAction,
  saveCandidateFeedbackAction,
} from "@/app/(protected)/projects/actions";

// ── Types ────────────────────────────────────────────────────────────────────

type EvidenceLink = {
  url: string;
  excerpt?: string | null;
  fetchedText?: string | null;
  summaryJson?: string | null;
};

type CandidateWithScore = {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  customData: string | null;
  evidenceLinks: EvidenceLink[];
  outreachDraft: { subject: string; body: string } | null;
  feedback: { misfit: boolean | null; reason: string | null } | null;
  score: any | null;
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function Badge({ tone, children }: { tone: "green" | "amber" | "slate" | "red"; children: React.ReactNode }) {
  const colors = {
    green: "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 ring-1 ring-emerald-200/50",
    amber: "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 ring-1 ring-amber-200/50",
    red: "bg-gradient-to-r from-red-50 to-rose-50 text-red-700 ring-1 ring-red-200/50",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[tone]}`}>{children}</span>;
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

// ── Evidence detail ───────────────────────────────────────────────────────────

function EvidenceDetail({ c, score }: { c: CandidateWithScore; score: any }) {
  const criteria = (score?.criteria ?? {}) as Record<string, number>;
  const evidenceLinks = c.evidenceLinks ?? [];
  const customData = c.customData
    ? (() => { try { return JSON.parse(c.customData) as Record<string, string>; } catch { return null; } })()
    : null;

  return (
    <details className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">Evidence & scoring inputs</summary>
      <div className="mt-4 space-y-5">
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

        {c.notes?.trim() && (
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Candidate notes</div>
            <p className="mt-1 text-sm text-slate-700">{c.notes}</p>
          </div>
        )}

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

// ── Candidate card ────────────────────────────────────────────────────────────

function CandidateCard({ c, projectId }: { c: CandidateWithScore; projectId: string }) {
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
            <ActionButton action={generateOutreachForCandidateAction.bind(null, c.id)} label="Generate outreach" pendingLabel="Generating…" className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50" />
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
          <SubmitButton label="Save" pendingLabel="Saving…" className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50" />
        </form>
      </details>
    </div>
  );
}

// ── Section renderers ─────────────────────────────────────────────────────────

function TierSection({
  title,
  tone,
  items,
  projectId,
}: {
  title: string;
  tone: "green" | "amber" | "slate";
  items: CandidateWithScore[];
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

function CategorySection({
  title,
  items,
  projectId,
}: {
  title: string;
  items: CandidateWithScore[];
  projectId: string;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">{items.length} companies</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5">
        {items.map((c) => (
          <CandidateCard key={c.id} c={c} projectId={projectId} />
        ))}
      </div>
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ResultsGroupingView({
  candidates,
  projectId,
}: {
  candidates: CandidateWithScore[];
  projectId: string;
}) {
  const [groupBy, setGroupBy] = useState<"tier" | string>("tier");
  const [tierFilter, setTierFilter] = useState<"all" | "A" | "B" | "C">("all");

  const customDataKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of candidates) {
      if (c.customData) {
        try {
          Object.keys(JSON.parse(c.customData) as Record<string, string>).forEach((k) => keys.add(k));
        } catch {}
      }
    }
    return Array.from(keys);
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (tierFilter === "all") return candidates;
    return candidates.filter((c) => c.score?.tier === tierFilter);
  }, [candidates, tierFilter]);

  const tiers = {
    A: filteredCandidates.filter((c) => c.score?.tier === "A"),
    B: filteredCandidates.filter((c) => c.score?.tier === "B"),
    C: filteredCandidates.filter((c) => c.score?.tier === "C"),
  };

  const categoryGroups = useMemo(() => {
    if (groupBy === "tier") return null;
    const groups = new Map<string, CandidateWithScore[]>();
    for (const c of filteredCandidates) {
      let val = "(Uncategorized)";
      if (c.customData) {
        try {
          const parsed = JSON.parse(c.customData) as Record<string, string>;
          if (parsed[groupBy]) val = parsed[groupBy];
        } catch {}
      }
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(c);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "(Uncategorized)") return 1;
      if (b === "(Uncategorized)") return -1;
      return a.localeCompare(b);
    });
  }, [candidates, groupBy, filteredCandidates]);

  return (
    <div className="space-y-6">
      {/* Group-by toggle bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Group by:</span>
        <button
          onClick={() => { setGroupBy("tier"); setTierFilter("all"); }}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
            groupBy === "tier"
              ? "bg-indigo-600 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          }`}
        >
          Tier
        </button>
        {customDataKeys.map((key) => (
          <button
            key={key}
            onClick={() => setGroupBy(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
              groupBy === key
                ? "bg-indigo-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
          >
            {key}
          </button>
        ))}

        {/* Tier filter pills — shown when in category mode */}
        {groupBy !== "tier" && (
          <div className="ml-3 flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="text-xs text-slate-400">Tier:</span>
            {(["all", "A", "B", "C"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                  tierFilter === t
                    ? "bg-slate-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t === "all" ? "All" : t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {groupBy === "tier" ? (
        <div className="space-y-8">
          <TierSection title="A-tier" tone="green" items={tiers.A} projectId={projectId} />
          <TierSection title="B-tier" tone="amber" items={tiers.B} projectId={projectId} />
          <TierSection title="C-tier" tone="slate" items={tiers.C} projectId={projectId} />
        </div>
      ) : (
        <div className="space-y-8">
          {categoryGroups!.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              No candidates match the current filter.
            </div>
          ) : (
            categoryGroups!.map(([label, items]) => (
              <CategorySection key={label} title={label} items={items} projectId={projectId} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
