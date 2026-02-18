"use client";

export default function LoginPage() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    // Dynamically create and submit a real HTML form to bypass Next.js interception
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/login";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "password";
    input.value = password;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/30">
      <div className="mx-auto max-w-md pt-24">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-indigo-500/5 backdrop-blur">
          <h1 className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            QM License Finder
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Single-user beta login. This prototype does not send emails and does not scrape.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                name="password"
                type="password"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Enter instance password"
                required
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 hover:brightness-110 active:scale-[0.98]"
            >
              Sign in
            </button>

            <p className="text-center text-xs text-slate-500">
              Set <code className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-indigo-700">APP_PASSWORD</code> in your <code className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-indigo-700">.env</code> file
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
