# QM License Finder — Prototype v0.1

Human‑in‑the‑loop *decision and prioritization* system for licensing partner identification:

**Search → shortlist → rationale → outreach drafts**

**Explicit non‑goals:** not a marketplace, not a deal room, not a CRM, not a contact scraper, not an auto‑email sender.

## What you can do in v0.1

- Create a **Project** (intake fields; never hard‑blocks; shows completeness + warnings).
- Build a **Candidate** list via:
  - **Generate (LLM)** (default)
  - **Upload CSV** (name, website optional, notes optional)
  - **Manual add**
- Attach **0–5 evidence links** per candidate (public URLs only; optional excerpt if fetch fails).
- Run **Scoring + Tiering** (A/B/C), producing:
  - 3–5 **A‑tier** candidates, 5–7 **B‑tier**, optional C
  - 3–5 rationale bullets per A‑tier candidate
  - proof points labeled as **link_supported** or **to_verify**
  - flags, disqualifiers, confidence label
- Generate **Outreach drafts** for A‑tier (no sending).
- **Export CSV** and a **printable HTML report** (Print → Save to PDF).
- Collect feedback:
  - project rating 1–5 + notes
  - candidate “misfit” checkbox + reason

## Architecture plan (thin slice, MVP‑forward)

### Stack
- Next.js (App Router) + TypeScript
- SQLite + Prisma
- Tailwind
- Zod
- LLM via env vars (OpenAI or Anthropic). Provider‑agnostic wrapper.

### Domain model (implemented now)
Project → Candidates → ScoreCards → OutreachDrafts → Outcomes (stubbed via OutcomeEvent)

### Structured outputs requirement
All LLM calls go through a **single `runStructured()`** wrapper that:
1) requests JSON‑only output
2) parses JSON
3) validates with Zod
4) retries (default 2)
5) logs a `ModelRunLog` record

### Evidence handling (light, v0.1)
- User attaches public URLs and/or pastes short excerpts.
- Server fetch is **best effort**, blocked for non‑http(s), localhost, private IPs.
- Evidence summaries are stored and used to produce **link_supported** proof points.
- If no evidence is attached, proof points are **to_verify** and confidence is capped at **Medium**.

### Privacy/data minimization guardrails
- No client names, deal terms, counterparty names are required or stored.
- No personal contact details are generated; model outputs are post‑processed to redact emails/phone numbers.
- No scraping behind logins or paywalls (only user‑provided public URLs).

## Setup

### 1) Install

```bash
npm install
```

### 2) Configure environment

Copy `.env.example` → `.env`:

```bash
cp .env.example .env
```

Required:
- `DATABASE_URL` (SQLite)
- `APP_PASSWORD` (single‑user login)
- `AUTH_SECRET` (cookie signing + password hashing salt)

Optional:
- `LLM_PROVIDER=openai|anthropic|mock`
- `OPENAI_API_KEY` / `OPENAI_MODEL`
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`

### 3) Database

```bash
npx prisma migrate dev
npx prisma db seed
```

### 4) Run

```bash
npm run dev
```

Open http://localhost:3000 and log in using `APP_PASSWORD`.

## Assumptions (v0.1)

- Single user per instance (password login). Multi‑tenant is deferred.
- No automated web search or search API.
- “Not on Licensing Expo exhibitor list” is implemented as:
  - built‑in “usual suspects/giants” exclude list
  - optional user exclude list per project
- Scale is qualitative (“emerging / mid / large”) and inferred; no employee‑count bands yet.
- Evidence fetch is best‑effort and may fail for some sites; user can paste excerpts.

## File / folder structure

```text
src/
  app/
    (public)/login/page.tsx
    (protected)/layout.tsx
    (protected)/projects/
      actions.ts
      page.tsx
      new/page.tsx
      [projectId]/page.tsx
      [projectId]/results/page.tsx
      [projectId]/report/page.tsx
    api/projects/[projectId]/export.csv/route.ts
    logout/route.ts
  components/
    PrintButton.tsx
  lib/
    auth.ts
    db.ts
    evidence.ts
    llm.ts
    prompts.ts
    prisma.ts
    schemas.ts
    scoring.ts
    utils.ts
prisma/
  schema.prisma
  seed.ts
```

## Anchor scenario seed

Running `npx prisma db seed` creates an “Anchor Scenario — Premium Outdoor → Home Goods” project with:
- intake fields filled
- ~10 seeded candidates
- pre‑seeded scorecards + outreach drafts for A‑tier

This lets DB or peers demo the workflow even without API keys.

## Next iteration backlog (MVP‑forward)

1) **Better evidence + citations**
- optional search API (SerpAPI/Bing) behind a feature flag
- URL‑level citations in proof points
- evidence “refresh” button and stale‑data markers

2) **Outcome learning hooks**
- richer outcome statuses (contacted, meeting, progressed, closed)
- lightweight analytics: which criteria correlate with wins

3) **Scoring UX improvements**
- per‑project weight editing (snapshot per scorecard)
- re‑score deltas and versioning

4) **Candidate dedupe + provenance**
- fuzzy matching
- “why added” capture

5) **Exports**
- fixed-format PDF export (server-side) once report layout stabilizes

6) **Auth hardening**
- move to `APP_PASSWORD_HASH`
- lockout/backoff

---

If you want, I can also produce a “DB test script” checklist (15‑minute anchor run) for beta testers.
