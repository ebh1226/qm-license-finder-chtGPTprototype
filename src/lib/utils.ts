import crypto from "crypto";

export const DEFAULT_GIANTS_EXCLUDE = [
  "YETI",
  "Patagonia",
  "The North Face",
  "Coleman",
  "Hydro Flask",
  "Stanley",
  "Igloo",
  "RTIC",
  "CamelBak",
  "REI Co-op",
];

export function parseExcludeList(text?: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isExcluded(candidateName: string, exclude: string[]): boolean {
  const n = candidateName.trim().toLowerCase();
  return exclude.some((e) => e.trim().toLowerCase() === n);
}

export function normalizeUrl(url?: string | null): string | null {
  if (!url) return null;
  let raw = url.trim().replace(/^<|>$/g, "").trim();
  if (!raw) return null;
  // Auto-add https:// if no protocol is present
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function isSafePublicHttpUrl(url: string): boolean {
  // Basic SSRF protections: block localhost, private IPs, non-http(s).
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return false;

  // Block obvious private IP ranges if hostname is a literal IP.
  const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  if (isIp) {
    const parts = host.split(".").map((p) => Number(p));
    if (parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
    const [a, b] = parts;
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
  }

  return true;
}

export function stripHtmlToText(html: string): string {
  // Lightweight HTML stripping: good enough for pre-MVP evidence summaries.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function clampText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}

export function redactPotentialContactDetails(text: string): string {
  // Guardrail: ensure we don't store or display personal contact details that the model might hallucinate.
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const phone = /\+?\d[\d\s().-]{7,}\d/g;
  return text.replace(email, "[REDACTED EMAIL]").replace(phone, "[REDACTED PHONE]");
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export type ParsedCandidateRow = { name: string; website?: string; notes?: string; links?: string[]; extraColumns?: Record<string, string> };

// Find the first header index that matches any of the given aliases.
function findCol(header: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = header.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseCsvCandidates(csv: string): ParsedCandidateRow[] {
  // Flexible CSV parser — accepts varied column names.
  // Supports quoted fields; does not support embedded newlines in quotes.
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const rows = lines.map(parseCsvLine);
  const header = rows[0].map((h) => h.toLowerCase().trim());

  const nameIdx = Math.max(0, findCol(header, ["name", "company", "company name", "candidate", "brand"]));
  const websiteIdx = findCol(header, ["website", "url", "site", "homepage", "company url", "company website", "web"]);
  const notesIdx = findCol(header, ["notes", "note", "description", "comments", "comment", "details", "info"]);
  const linksIdx = findCol(header, ["links", "link", "source", "sources", "evidence", "references", "reference"]);

  // Identify known column indices so we can capture everything else
  const knownIndices = new Set([nameIdx, websiteIdx, notesIdx, linksIdx].filter((i) => i >= 0));
  const originalHeaders = rows[0].map((h) => h.trim());
  const extraColIndices = header.map((_, i) => i).filter((i) => !knownIndices.has(i));

  return rows
    .slice(1)
    .map((cols) => {
      const name = (cols[nameIdx] ?? "").trim();
      const website = websiteIdx >= 0 ? (cols[websiteIdx] ?? "").trim() : undefined;
      const notes = notesIdx >= 0 ? (cols[notesIdx] ?? "").trim() : undefined;
      const linksRaw = linksIdx >= 0 ? (cols[linksIdx] ?? "").trim() : undefined;
      const links = linksRaw
        ? linksRaw.split(/[;\s]+/).map((u) => u.trim()).filter((u) => u.length > 0)
        : undefined;

      // Collect any extra columns into a key-value map
      const extra: Record<string, string> = {};
      for (const i of extraColIndices) {
        const val = (cols[i] ?? "").trim();
        if (val) extra[originalHeaders[i]] = val;
      }
      const extraColumns = Object.keys(extra).length > 0 ? extra : undefined;

      return { name, website, notes, links, extraColumns };
    })
    .filter((r) => r.name.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().length > 0);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function toCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}
