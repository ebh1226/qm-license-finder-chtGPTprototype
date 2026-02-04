import { isSafePublicHttpUrl, stripHtmlToText, clampText } from "@/lib/utils";

export async function fetchPublicUrlText(url: string): Promise<{ ok: boolean; text?: string; error?: string; contentType?: string }> {
  if (!isSafePublicHttpUrl(url)) {
    return { ok: false, error: "URL blocked (only public http(s) allowed)" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "QM-License-Finder/0.1 (+prototype)",
        "Accept": "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
      },
    });

    const contentType = resp.headers.get("content-type") ?? "";
    if (!resp.ok) {
      return { ok: false, error: `Fetch failed (${resp.status})`, contentType };
    }

    // Limit size
    const raw = await resp.text();
    const limited = clampText(raw, 25000);
    const text = contentType.includes("text/html") ? stripHtmlToText(limited) : limited;

    return { ok: true, text: clampText(text, 12000), contentType };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}
