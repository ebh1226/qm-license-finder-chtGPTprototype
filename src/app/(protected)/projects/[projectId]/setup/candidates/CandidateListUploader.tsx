"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadCandidatesCsvAction } from "@/app/(protected)/projects/actions";

type FileEntry = { id: string; name: string; status: "uploading" | "done" | "error" };

export default function CandidateListUploader({
  projectId,
  projectName,
  nextUrl,
}: {
  projectId: string;
  projectName: string;
  nextUrl: string;
}) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    e.target.value = "";

    for (const file of selected) {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      setFiles((prev) => [...prev, { id, name: file.name, status: "uploading" }]);

      const fd = new FormData();
      fd.append("file", file);

      try {
        await uploadCandidatesCsvAction(projectId, fd);
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "done" } : f)));
      } catch {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error" } : f)));
      }
    }
  }

  const anyUploading = files.some((f) => f.status === "uploading");

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
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">2</span>
            <span className="text-xs font-medium text-indigo-700">Candidate list</span>
          </div>
          <div className="h-px w-6 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-500">3</span>
            <span className="text-xs text-slate-400">Manual add</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 ring-1 ring-indigo-200/50">
            <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Upload candidate list</h1>
          <p className="mt-1 text-sm text-slate-500"><span className="font-medium text-slate-700">{projectName}</span></p>
        </div>

        {/* Upload card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Do you have an existing candidate list to upload? These companies will be added as candidates for this project and used as additional context during research and scoring.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Accepted: CSV or Excel (.xlsx, .xls). Required column: <span className="font-mono">name</span> or <span className="font-mono">company</span>. Optional: website, notes, links — any extra columns are preserved and used in scoring. This step is optional.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,.xlsx,.xls"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={anyUploading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
            </svg>
            Choose files to upload
          </button>

          {files.length > 0 && (
            <ul className="mt-4 space-y-2">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5">
                  {f.status === "uploading" && (
                    <svg className="h-4 w-4 animate-spin text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {f.status === "done" && (
                    <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {f.status === "error" && (
                    <svg className="h-4 w-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="truncate text-sm text-slate-700">{f.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-slate-400">
                    {f.status === "uploading" ? "Importing…" : f.status === "done" ? "Imported" : "Failed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Continue */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">You can upload more lists later from the project page.</p>
          <button
            type="button"
            disabled={anyUploading}
            onClick={() => router.push(nextUrl)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {anyUploading ? "Importing…" : "Continue"}
            {!anyUploading && (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
