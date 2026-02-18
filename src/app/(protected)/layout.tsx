import Link from "next/link";
import { requireAuth } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              QM License Finder
            </Link>
            <span className="rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200/50">
              Prototype v0.1
            </span>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/projects" className="rounded-lg px-3 py-2 font-medium text-slate-600 transition-colors duration-200 hover:bg-indigo-50 hover:text-indigo-700">
              Projects
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs text-slate-500">
        <div className="border-t border-slate-200/80 pt-4">
          <p>
            Guardrails: no scraping behind logins, no bypassing paywalls, no personal contact details, no deal terms.
          </p>
        </div>
      </footer>
    </div>
  );
}
