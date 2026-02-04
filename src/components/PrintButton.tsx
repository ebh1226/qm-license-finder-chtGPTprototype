"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
