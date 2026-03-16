"use client";

import { useRef, useState } from "react";

type UploadStatus = "uploading" | "done" | "error";

export default function CandidatesBulkUploader({
  projectId,
  actionLabel,
  uploadAction,
  accept = ".csv,text/csv,.xlsx,.xls",
}: {
  projectId: string;
  actionLabel: string;
  uploadAction: (projectId: string, formData: FormData) => Promise<void>;
  accept?: string;
}) {
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [lastName, setLastName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setLastName(file.name);
    setStatus("uploading");
    const fd = new FormData();
    fd.append("file", file);
    try {
      await uploadAction(projectId, fd);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs font-medium text-slate-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "uploading" ? "Uploading…" : actionLabel}
      </button>
      {status === "done" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="truncate">{lastName} imported</span>
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-xs text-red-500">Upload failed. Try again.</p>
      )}
    </section>
  );
}
