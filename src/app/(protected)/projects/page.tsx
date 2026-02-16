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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="mt-2 text-sm text-slate-600">
            Each project captures intake fields, candidate list, scorecards, outreach drafts, and outcomes.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 hover:brightness-110 active:scale-[0.98]"
        >
          New project
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700">
            <tr>
              <th className="px-5 py-4 text-left font-semibold">Name</th>
              <th className="px-5 py-4 text-left font-semibold">Updated</th>
              <th className="px-5 py-4 text-left font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-slate-500" colSpan={3}>
                  No projects yet. Create one to get started.
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 transition-colors duration-200 hover:bg-indigo-50/50">
                  <td className="px-5 py-4">
                    <Link href={`/projects/${p.id}`} className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{new Date(p.updatedAt).toLocaleString()}</td>
                  <td className="px-5 py-4 text-slate-600">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-sm text-amber-900 shadow-sm">
        <p className="font-semibold">Reminder</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Web search (Serper) runs automatically during research — evidence links are fetched and summarized for each candidate.</li>
          <li>Proof points are labeled by support type: <strong>link-supported</strong>, <strong>user-provided</strong>, or <strong>to-verify</strong>. Always verify before client delivery.</li>
          <li>No personal contact details are generated; outreach drafts use role/title placeholders only.</li>
        </ul>
      </div>
    </div>
  );
}
