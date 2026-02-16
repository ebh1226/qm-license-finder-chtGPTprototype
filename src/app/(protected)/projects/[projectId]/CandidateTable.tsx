"use client";

import { useState, useTransition } from "react";
import {
  addEvidenceLinkAction,
  deleteCandidateAction,
  deleteCandidatesBatchAction,
  researchCandidatesBatchAction,
  scoreAndTierCandidatesBatchAction,
} from "@/app/(protected)/projects/actions";

type CandidateData = {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  customData: string | null;
  provenance: string;
  evidenceLinks: Array<{
    id: string;
    url: string;
    summaryJson: string | null;
  }>;
  scoreCard: {
    tier: string | null;
    totalScore: number;
  } | null;
};

export default function CandidateTable({
  candidates,
  projectId,
}: {
  candidates: CandidateData[];
  projectId: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const allSelected = candidates.length > 0 && selected.size === candidates.length;
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBatchDelete() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await deleteCandidatesBatchAction(projectId, ids);
      setSelected(new Set());
    });
  }

  function handleBatchResearch() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await researchCandidatesBatchAction(projectId, ids);
      setSelected(new Set());
    });
  }

  function handleBatchScore() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await scoreAndTierCandidatesBatchAction(projectId, ids);
      setSelected(new Set());
    });
  }

  return (
    <>
      {/* Selection action bar */}
      {someSelected && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3">
          <span className="text-sm font-medium text-indigo-700">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBatchResearch}
              disabled={isPending}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 active:scale-[0.98]"
            >
              {isPending ? "Working…" : "Research selected"}
            </button>
            <button
              onClick={handleBatchScore}
              disabled={isPending}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 active:scale-[0.98]"
            >
              {isPending ? "Working…" : "Score & tier selected"}
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={isPending}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-all duration-200 hover:border-red-300 hover:bg-red-50 disabled:opacity-50 active:scale-[0.98]"
            >
              {isPending ? "Working…" : "Delete selected"}
            </button>
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-slate-500 hover:text-slate-700"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">Company</th>
              <th className="px-4 py-3 text-left font-semibold">Provenance</th>
              <th className="px-4 py-3 text-left font-semibold">Tier</th>
              <th className="px-4 py-3 text-left font-semibold">Evidence</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                  No candidates yet. Generate or upload a CSV.
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr
                  id={`candidate-${c.id}`}
                  key={c.id}
                  className={`border-t border-slate-100 align-top transition-colors duration-200 ${
                    selected.has(c.id) ? "bg-indigo-50/70" : "hover:bg-indigo-50/50"
                  }`}
                >
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">{c.name}</div>
                    {c.website && (
                      <a
                        className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {c.website}
                      </a>
                    )}
                    {c.notes && <div className="mt-1 text-xs text-slate-500">{c.notes}</div>}
                    {c.customData &&
                      (() => {
                        try {
                          const custom = JSON.parse(c.customData) as Record<string, string>;
                          const entries = Object.entries(custom);
                          if (entries.length === 0) return null;
                          return (
                            <div className="mt-1 space-y-0.5">
                              {entries.slice(0, 5).map(([k, v]) => (
                                <div key={k} className="text-xs text-slate-400">
                                  <span className="font-medium text-slate-500">{k}:</span> {v}
                                </div>
                              ))}
                              {entries.length > 5 && (
                                <div className="text-[11px] text-slate-400">
                                  +{entries.length - 5} more fields
                                </div>
                              )}
                            </div>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {c.provenance}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        c.scoreCard?.tier === "A"
                          ? "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 ring-1 ring-emerald-200"
                          : c.scoreCard?.tier === "B"
                            ? "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 ring-1 ring-amber-200"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c.scoreCard?.tier ?? "—"}
                    </span>
                    {c.scoreCard && (
                      <div className="mt-1 text-xs text-slate-500">
                        Score: {c.scoreCard.totalScore}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500">
                        Links: {c.evidenceLinks.length}
                      </div>
                      {c.evidenceLinks.length ? (
                        <ul className="space-y-1 text-xs">
                          {c.evidenceLinks.slice(0, 3).map((l) => (
                            <li
                              key={l.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <a
                                href={l.url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                {l.url}
                              </a>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  l.summaryJson
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {l.summaryJson ? "summarized" : "pending"}
                              </span>
                            </li>
                          ))}
                          {c.evidenceLinks.length > 3 ? (
                            <li className="text-[11px] text-slate-400">
                              +{c.evidenceLinks.length - 3} more…
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                      <details className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                          Add evidence link / excerpt
                        </summary>
                        <form
                          action={addEvidenceLinkAction.bind(null, c.id)}
                          className="mt-3 space-y-3"
                        >
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
                          <button
                            type="submit"
                            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                          >
                            Save & summarize
                          </button>
                          <p className="text-[11px] text-slate-400">
                            We only fetch public URLs. No scraping behind logins. If fetch
                            fails, paste an excerpt.
                          </p>
                        </form>
                      </details>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <form action={deleteCandidateAction.bind(null, c.id)}>
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-red-500 transition-all duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700 active:scale-[0.98]"
                        title="Remove candidate"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
