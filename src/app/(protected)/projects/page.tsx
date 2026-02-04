import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export default async function ProjectsPage() {
  const user = await requireAuth();
  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Each project captures intake fields → candidate list → scorecards → outreach drafts → (stub) outcomes.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          New project
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Updated</th>
              <th className="px-4 py-3 text-left font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-600" colSpan={3}>
                  No projects yet. Create one to run the anchor scenario.
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(p.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Reminder</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>No search API in v0.1 — attach public evidence links or paste short excerpts for stronger proof points.</li>
          <li>Outputs are labeled: link-supported vs to-verify. Always verify before client delivery.</li>
          <li>No personal contact details are generated; use roles/titles only.</li>
        </ul>
      </div>
    </div>
  );
}
