import { z, type ZodSchema } from "zod";
import { prisma } from "@/lib/prisma";
import { redactPotentialContactDetails, sha256 } from "@/lib/utils";

type Provider = "openai" | "anthropic" | "gemini" | "mock";

type LlmResult = {
  text: string;
  model: string;
  provider: Provider;
  tokensIn?: number;
  tokensOut?: number;
};

function mockByPrompt(promptName: string): string {
  if (promptName === "candidate_generation") {
    return JSON.stringify({
      candidates: [
        { name: "MiiR", website: "https://www.miir.com", notes: "Premium drinkware; brand collaborations.", whyNonObvious: "Not a mega-giant; often overlooked." },
        { name: "GSI Outdoors", website: "https://www.gsioutdoors.com", notes: "Camp kitchen + drinkware adjacency; specialty outdoor retail." },
        { name: "Snow Peak", website: "https://www.snowpeak.com", notes: "Premium outdoor lifestyle + home/outdoor entertaining adjacency." },
        { name: "Klean Kanteen", website: "https://www.kleankanteen.com", notes: "Quality reputation; premium positioning." },
        { name: "W&P", website: "https://wandp.com", notes: "Premium home goods; could extend to outdoor entertaining accessories." },
        { name: "Stojo", website: "https://www.stojo.co", notes: "Reusable drinkware; potential licensing openness." },
        { name: "OXO", website: "https://www.oxo.com", notes: "Quality home goods; scale risk—verify channel fit." },
        { name: "Sea to Summit", website: "https://seatosummit.com", notes: "Outdoor gear brand; accessory manufacturing capability." },
        { name: "S'well", website: "https://www.swell.com", notes: "Premium drinkware; fashion/home channel adjacency." },
        { name: "Stanley 1913", website: "https://www.stanley1913.com", notes: "Obvious giant; include only if not excluded." }
      ]
    });
  }

  if (promptName === "score_candidate") {
    return JSON.stringify({
      criterionScores: {
        categoryFit: 4,
        distributionAlignment: 4,
        licensingActivity: 3,
        scaleAppropriateness: 3,
        qualityReputation: 4,
        geoCoverage: 4,
        recentMomentum: 3,
        manufacturingCapability: 4,
      },
      disqualifiers: [],
      flags: ["Verify specialty retail mix", "Confirm openness to third-party licensing"],
      rationaleBullets: [
        "Strong adjacency: premium drinkware / outdoor entertaining aligns with requested home-goods expansion",
        "Brand + product systems likely to meet $40–$150 price band (verify SKU-level pricing)",
        "Distribution appears compatible with specialty outdoor + boutique channels (verify channel mix)",
        "Manufacturing capability likely supports hardgoods/accessories with quality expectations",
      ],
      proofPoints: [
        { text: "Look for partnerships/collabs or licensing mentions on press/news pages", supportType: "to_verify", url: null },
        { text: "Confirm presence in REI / specialty outdoor retailers (store locators / wholesale pages)", supportType: "to_verify", url: null },
      ],
      confidence: "Medium",
      nextStep: "Warm intro if you have a mutual connection; otherwise a targeted cold outreach to Licensing/Partnerships lead",
    });
  }

  if (promptName === "outreach_draft") {
    return JSON.stringify({
      subject: "Exploring a premium outdoor-home goods licensing fit",
      body:
        "Hi [Name],\n\nI run licensing strategy for a premium outdoor lifestyle brand expanding into home goods (drinkware, coolers, outdoor entertaining accessories) in the $40–$150 range, with a specialty-first channel focus (REI, independent outdoor retailers, and upscale home-goods boutiques).\n\nYour team’s product and brand positioning looks like a strong adjacency for a selective licensing partnership. [PLACEHOLDER: insert 1–2 concrete proof points once verified].\n\nWould you be open to a short exploratory call to see if there’s a mutual fit and to understand your preferred partnership model?\n\nBest,\n[Your Name]",
    });
  }

  if (promptName === "candidate_research") {
    return JSON.stringify({
      website: "https://www.example.com",
      description: "A premium outdoor goods manufacturer with specialty retail focus.",
      category: "Outdoor lifestyle / home goods",
      licensingHistory: "Known to have licensing partnerships in the outdoor space.",
      keyProducts: "Drinkware, outdoor entertaining accessories",
      distributionChannels: "Specialty outdoor retailers, upscale boutiques",
      notablePartnerships: null,
      searchQueries: [
        "Example Company licensing partnerships",
        "Example Company outdoor products distribution",
      ],
    });
  }

  if (promptName === "evidence_summary") {
    return JSON.stringify({
      bullets: [
        { text: "Evidence link highlights relevant product/category adjacency (summary)." },
        { text: "Evidence link suggests distribution/channel alignment indicators (summary)." },
      ],
    });
  }

  return "{}";
}

function getProvider(): Provider {
  const p = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  if (p === "openai" || p === "anthropic" || p === "gemini" || p === "mock") return p;
  return "openai";
}

function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractFirstJson(text: string): string | null {
  // If a model returns extra text, attempt to extract the first {...} or [...] block.
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;

  const firstObj = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  const start = firstObj >= 0 && firstArr >= 0 ? Math.min(firstObj, firstArr) : Math.max(firstObj, firstArr);
  if (start < 0) return null;
  // naive brace matching (good enough for repair attempts)
  const stack: string[] = [];
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "{" || ch === "[") stack.push(ch);
    if (ch === "}" || ch === "]") {
      const last = stack.pop();
      if (!last) continue;
    }
    if (stack.length === 0) {
      return trimmed.slice(start, i + 1);
    }
  }
  return null;
}

async function openaiCall({
  promptName,
  system,
  user,
  jsonOnly,
}: {
  promptName: string;
  system: string;
  user: string;
  jsonOnly: boolean;
}): Promise<LlmResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { provider: "mock", model: "mock", text: mockByPrompt(promptName) };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const body = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(jsonOnly ? { response_format: { type: "json_object" } } : {}),
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenAI error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await resp.json()) as any;
  const text = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage;

  return {
    provider: "openai",
    model,
    text,
    tokensIn: usage?.prompt_tokens,
    tokensOut: usage?.completion_tokens,
  };
}

async function anthropicCall({
  promptName,
  system,
  user,
}: {
  promptName: string;
  system: string;
  user: string;
}): Promise<LlmResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { provider: "mock", model: "mock", text: mockByPrompt(promptName) };
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  const body = {
    model,
    max_tokens: 1800,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content: user }],
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Anthropic error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await resp.json()) as any;
  const content = data?.content?.[0]?.text ?? "";
  const usage = data?.usage;

  return {
    provider: "anthropic",
    model,
    text: content,
    tokensIn: usage?.input_tokens,
    tokensOut: usage?.output_tokens,
  };
}

async function geminiCall({
  promptName,
  system,
  user,
}: {
  promptName: string;
  system: string;
  user: string;
}): Promise<LlmResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { provider: "mock", model: "mock", text: mockByPrompt(promptName) };
  }

  const model = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${system}\n\n${user}` }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Gemini error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await resp.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const usage = data?.usageMetadata;

  return {
    provider: "gemini",
    model,
    text,
    tokensIn: usage?.promptTokenCount,
    tokensOut: usage?.candidatesTokenCount,
  };
}

function mockText(payload: unknown): string {
  return JSON.stringify(payload);
}

async function callProvider({
  promptName,
  system,
  user,
  jsonOnly,
}: {
  promptName: string;
  system: string;
  user: string;
  jsonOnly: boolean;
}): Promise<LlmResult> {
  const provider = getProvider();
  if (provider === "anthropic") return anthropicCall({ promptName, system, user });
  if (provider === "gemini") return geminiCall({ promptName, system, user });
  if (provider === "openai") return openaiCall({ promptName, system, user, jsonOnly });
  return { provider: "mock", model: "mock", text: mockByPrompt(promptName) };
}

export async function runStructured<T>(opts: {
  promptName: string;
  system: string;
  user: string;
  schema: ZodSchema<T>;
  jsonOnly?: boolean;
  maxRetries?: number;
}): Promise<{ data: T; rawText: string; provider: string; model: string }> {
  const {
    promptName,
    system,
    user,
    schema,
    jsonOnly = true,
    maxRetries = 4,
  } = opts;

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Truncated exponential backoff: 1s, 2s, 4s, ... capped at 16s
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
      const jitter = Math.random() * delayMs * 0.5;
      await new Promise((r) => setTimeout(r, delayMs + jitter));
    }

    try {
      const res = await callProvider({ promptName, system, user, jsonOnly });
      const cleaned = redactPotentialContactDetails(res.text).trim();

      const candidateJsonText = extractFirstJson(cleaned) ?? cleaned;
      const parsed = safeJsonParse(candidateJsonText);

      if (!parsed) {
        throw new Error("Model did not return valid JSON");
      }

      // Some models (e.g. Gemini) wrap a single object in an array — unwrap it.
      const unwrapped = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;

      const validated = schema.safeParse(unwrapped);
      if (!validated.success) {
        throw new Error(`Schema validation failed: ${validated.error.message}`);
      }

      await prisma.modelRunLog.create({
        data: {
          promptName,
          provider: res.provider,
          model: res.model,
          success: true,
          tokensIn: res.tokensIn,
          tokensOut: res.tokensOut,
        },
      });

      return { data: validated.data, rawText: cleaned, provider: res.provider, model: res.model };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await prisma.modelRunLog.create({
        data: {
          promptName,
          provider: getProvider(),
          model: process.env.OPENAI_MODEL || process.env.ANTHROPIC_MODEL || "unknown",
          success: false,
          error: lastError,
        },
      });

      if (attempt === maxRetries) break;
    }
  }

  throw new Error(`Structured LLM call failed after retries (${promptName}): ${lastError}`);
}

export function debugPromptHash(promptName: string, system: string, user: string): string {
  return sha256(`${promptName}|${system}|${user}`);
}

export const LlmSchemas = { z };
