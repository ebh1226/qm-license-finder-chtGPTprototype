import Link from "next/link";
import { createProjectAction } from "@/app/(protected)/projects/actions";

export default function NewProjectPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">New project</h1>
          <p className="mt-2 text-sm text-slate-600">
            Fast intake (60–90 seconds). Missing fields don't block; they reduce evidence level.
          </p>
        </div>
        <Link href="/projects" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
          Back
        </Link>
      </div>

      <form action={createProjectAction} className="space-y-8">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Basic Information</h2>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Project name</span>
              <input
                name="name"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g. Anchor Scenario — Premium Outdoor → Home Goods"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Brand category</span>
              <input
                name="brandCategory"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g. Premium outdoor lifestyle brand (Yeti/Patagonia aesthetic)"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Product types sought</span>
              <input
                name="productTypeSought"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g. Drinkware, coolers, outdoor entertaining accessories"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Price range</span>
              <input
                name="priceRange"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g. $40–$150"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Distribution preference</span>
              <input
                name="distributionPreference"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g. REI, independent outdoor retailers, upscale home goods boutiques"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Geography <span className="font-normal text-slate-400">(optional)</span></span>
              <input
                name="geography"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g. US + Canada"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Positioning keywords <span className="font-normal text-slate-400">(optional)</span></span>
              <input
                name="positioningKeywords"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g. premium, design-led, durable, outdoor entertaining"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Constraints <span className="font-normal text-slate-400">(optional)</span></span>
              <textarea
                name="constraints"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                rows={3}
                placeholder="e.g. Avoid mass-market dominated partners; prioritize quality/reputation"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Exclude List <span className="font-normal text-slate-400">(one per line)</span></span>
              <textarea
                name="excludeList"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                rows={4}
                placeholder={"e.g.\nYeti\nPatagonia\nThe North Face"}
              />
              <p className="mt-2 text-xs text-slate-500">Used to filter out "usual suspects" and known exhibitors/competitors.</p>
            </label>
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" className="rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 hover:brightness-110 active:scale-[0.98]">
            Create project
          </button>
          <Link href="/projects" className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
