export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

/**
 * Search the web using the best available provider.
 * Priority: Serper.dev → Google CSE → empty (with warning).
 */
export async function webSearch(query: string, maxResults = 3): Promise<SearchResult[]> {
  // Try Serper first
  if (process.env.SERPER_API_KEY) {
    return serperSearch(query, maxResults);
  }

  // Fall back to Google CSE
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
    return googleCseSearch(query, maxResults);
  }

  console.warn("No search provider configured (SERPER_API_KEY or GOOGLE_API_KEY/GOOGLE_CSE_ID). Skipping web search.");
  return [];
}

// Keep the old name as an alias so nothing breaks
export const googleCustomSearch = webSearch;

async function serperSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  try {
    const resp = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: Math.min(maxResults, 10) }),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error(`Serper error ${resp.status}: ${errText.slice(0, 300)}`);
      return [];
    }

    const data = (await resp.json()) as any;
    const organic = data?.organic ?? [];

    return organic.slice(0, maxResults).map((item: any) => ({
      title: String(item.title ?? ""),
      url: String(item.link ?? ""),
      snippet: String(item.snippet ?? ""),
    }));
  } catch (err) {
    console.error("Serper fetch failed:", err);
    return [];
  }
}

async function googleCseSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    key: process.env.GOOGLE_API_KEY!,
    cx: process.env.GOOGLE_CSE_ID!,
    q: query,
    num: String(Math.min(maxResults, 10)),
  });

  try {
    const resp = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error(`Google CSE error ${resp.status}: ${errText.slice(0, 300)}`);
      return [];
    }

    const data = (await resp.json()) as any;
    const items = data?.items ?? [];

    return items.slice(0, maxResults).map((item: any) => ({
      title: String(item.title ?? ""),
      url: String(item.link ?? ""),
      snippet: String(item.snippet ?? ""),
    }));
  } catch (err) {
    console.error("Google CSE fetch failed:", err);
    return [];
  }
}
