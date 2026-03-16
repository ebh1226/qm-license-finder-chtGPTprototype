"use client";

import { useRouter } from "next/navigation";

export default function BrandSelector({
  projects,
  selectedId,
  selectedName,
}: {
  projects: { id: string; name: string }[];
  selectedId?: string;
  selectedName?: string;
}) {
  const router = useRouter();

  if (projects.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <label htmlFor="brand-selector" className="shrink-0 text-sm font-medium text-slate-700">
          Copy brand info from:
        </label>
        <select
          id="brand-selector"
          defaultValue={selectedId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              router.push(`/projects/new?from=${val}`);
            } else {
              router.push("/projects/new");
            }
          }}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">— start fresh —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {selectedName && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-indigo-700">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Brand info pre-filled from <span className="font-semibold">{selectedName}</span>. Deal fields are blank — fill them in for this scenario.
        </p>
      )}
    </div>
  );
}
