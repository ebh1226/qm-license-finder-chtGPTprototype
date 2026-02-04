import Link from "next/link";
import { requireAuth } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/projects" className="font-semibold tracking-tight">
              QM License Finder — Prototype v0.1
            </Link>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              Pre‑MVP (no search API)
            </span>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/projects" className="rounded-md px-2 py-1 hover:bg-slate-100">
              Projects
            </Link>
            <Link href="/logout" className="rounded-md px-2 py-1 hover:bg-slate-100">
              Logout
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs text-slate-500">
        <div className="border-t border-slate-200 pt-4">
          <p>
            Guardrails: no scraping behind logins, no bypassing paywalls, no personal contact details, no deal terms.
          </p>
        </div>
      </footer>
    </div>
  );
}
