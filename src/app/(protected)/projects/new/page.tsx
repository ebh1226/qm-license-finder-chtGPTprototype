import Link from "next/link";
import { createProjectAction } from "@/app/(protected)/projects/actions";

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
          <p className="mt-1 text-sm text-slate-600">
            Fast intake (60–90 seconds). Missing fields don’t block; they reduce confidence.
          </p>
        </div>
        <Link href="/projects" className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
          Back
        </Link>
      </div>

      <form action={createProjectAction} className="space-y-6">
        <div className="rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Basic</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Project name</span>
              <input
                name="name"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                defaultValue="Anchor Scenario — Premium Outdoor → Home Goods"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Brand category</span>
              <input
                name="brandCategory"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                defaultValue="Premium outdoor lifestyle brand (Yeti/Patagonia aesthetic)"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Product types sought</span>
              <input
                name="productTypeSought"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                defaultValue="Drinkware, coolers, outdoor entertaining accessories"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Price range</span>
              <input
                name="priceRange"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                defaultValue="$40–$150"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Distribution preference</span>
              <input
                name="distributionPreference"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                defaultValue="REI, independent outdoor retailers, upscale home goods boutiques (not mass market)"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Geography (optional)</span>
              <input
                name="geography"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                defaultValue="US + Canada"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Positioning keywords (optional)</span>
              <input
                name="positioningKeywords"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                defaultValue="premium, design-led, durable, outdoor entertaining"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Constraints (optional)</span>
              <textarea
                name="constraints"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                defaultValue="Avoid mass-market dominated partners; prioritize quality/reputation"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Exclude List (one per line)</span>
              <textarea
                name="excludeList"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={4}
                defaultValue={`Yeti\nPatagonia\nThe North Face\nHydro Flask\nStanley 1913\nColeman\nIgloo`}
              />
              <p className="mt-1 text-xs text-slate-500">Used to filter out “usual suspects” and known exhibitors/competitors (heuristic in v0.1).</p>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Create project
          </button>
          <Link href="/projects" className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
