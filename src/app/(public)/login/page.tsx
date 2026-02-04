import { loginWithPassword } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function LoginPage() {
  async function action(formData: FormData) {
    "use server";
    const password = String(formData.get("password") || "");
    await loginWithPassword(password);
    redirect("/projects");
  }

  return (
    <div className="mx-auto mt-20 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">QM License Finder</h1>
      <p className="mt-1 text-sm text-slate-600">
        Single-user beta login (password from environment). This prototype does not send emails and does not scrape.
      </p>

      <form action={action} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            name="password"
            type="password"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring"
            placeholder="Enter instance password"
            required
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Sign in
        </button>

        <p className="text-xs text-slate-500">
          Tip: set <code className="rounded bg-slate-100 px-1">APP_PASSWORD</code> and <code className="rounded bg-slate-100 px-1">AUTH_SECRET</code> in <code className="rounded bg-slate-100 px-1">.env</code>.
        </p>
      </form>
    </div>
  );
}
