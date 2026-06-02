/**
 * /api/extract-requirements
 *
 * Accepts unstructured input — pasted text OR uploaded PDF — and returns a
 * structured ProjectInput JSON that can pre-fill the /new-project form.
 *
 * Built in response to AIC prelim feedback: "unstructured data as an
 * input/data source need to be implemented".
 *
 * Pipeline:
 *   1. Accept multipart form (text and/or PDF file)
 *   2. If PDF: parse to text via pdf-parse
 *   3. Send combined text to AI with focused extraction prompt
 *   4. Return structured JSON + per-field confidence
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60;

// ─── Same provider clients as /api/generate ─────────────────────────────────

function getCerebrasClient() {
  return new OpenAI({
    apiKey: process.env.CEREBRAS_API_KEY!,
    baseURL: 'https://api.cerebras.ai/v1',
    maxRetries: 0,
  });
}
function getMistralClient() {
  return new OpenAI({
    apiKey: process.env.MISTRAL_API_KEY!,
    baseURL: 'https://api.mistral.ai/v1',
    maxRetries: 0,
  });
}
function getSambaNovaClient() {
  return new OpenAI({
    apiKey: process.env.SAMBANOVA_API_KEY!,
    baseURL: 'https://api.sambanova.ai/v1',
    maxRetries: 0,
  });
}

interface ExtractorConfig {
  provider: 'cerebras' | 'mistral' | 'sambanova';
  model: string;
  client: OpenAI;
}

function buildExtractorChain(): ExtractorConfig[] {
  const chain: ExtractorConfig[] = [];
  if (process.env.CEREBRAS_API_KEY) {
    chain.push({ provider: 'cerebras', model: 'qwen-3-235b-a22b-instruct-2507', client: getCerebrasClient() });
  }
  if (process.env.MISTRAL_API_KEY) {
    chain.push({ provider: 'mistral', model: 'mistral-medium-latest', client: getMistralClient() });
  }
  if (process.env.SAMBANOVA_API_KEY) {
    chain.push({ provider: 'sambanova', model: 'Meta-Llama-3.3-70B-Instruct', client: getSambaNovaClient() });
  }
  return chain;
}

// ─── Extraction prompt ──────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are an industrial engineering requirement extractor. You read unstructured client documents (RFQs, emails, meeting transcripts, specifications) and extract structured project parameters for a Malaysian fluid system engineering tool.

Your single job: read the input text and output ONE JSON object with these fields:

{
  "projectName":       "short project name (4-8 words) derived from the document",
  "industry":          "ONE of: Oil & Gas | Palm Oil & Agriculture | Food & Beverage | Water & Wastewater Treatment | Pharmaceutical | Semiconductor & E&E | Rubber & Latex | Chemicals | Petrochemical | Pulp & Paper | Power Generation | Cold Chain / Refrigeration | General Manufacturing",
  "fluidType":         "ONE of: water_utility | cooling_water | demineralised_water | ultrapure_water | purified_water | wfi | seawater | chilled_water | steam_lp | steam_hp | crude_oil | natural_gas | lng | fuel_oil | hydraulic_oil | glycol | cpo | pko | rbdpo | palm_fatty_acid | compressed_air | nitrogen | co2 | ammonia_gas | latex | ammonia_latex | formic_acid | refrigerant_hfc | refrigerant_co2 | refrigerant_nh3 | slurry | palm_effluent | wastewater | chemical_acid | chemical_alkali | chemical_solvent | chemical_other | other",
  "customFluidType":   "if fluidType is chemical_* or other, the actual fluid name from the doc, otherwise null",
  "malaysiaState":     "ONE of: kuala_lumpur | selangor | penang | johor | perak | negeri_sembilan | melaka | pahang | terengganu | kelantan | kedah | perlis | sabah | sarawak | putrajaya | labuan — pick the state matching any location mentioned. If nothing matches, default to selangor.",
  "siteEnvironment":   "ONE of: indoor industrial | outdoor exposed | hazardous area | clean room | offshore | underground",
  "application":       "2-4 sentences describing the application — what the fluid does, where, what conditions, what the engineer is trying to achieve. Synthesise from the source text.",
  "budget":            "numeric MYR value extracted from the doc. If not given, estimate sensibly based on industry/scale (e.g. cooling water ~RM 300k, large refinery ~RM 5M). If ambiguous, default to 500000.",
  "specialRequirements": "any compliance, redundancy, or design constraints mentioned (e.g. 'BOMBA, redundant pumps, 24/7'). If none, return empty string.",
  "scaleFlowRateValue":  "numeric flow rate value if mentioned, else null",
  "scaleFlowRateUnit":   "L/min | m³/hr | GPM — pick the matching unit if flow rate is given, else null",
  "scaleVolumeMonthlyValue": "monthly volume if mentioned, else null",
  "scaleVolumeMonthlyUnit":  "m³/month | L/month | gallons/month — if given, else null",
  "_confidence": {
    "projectName":          0-100,
    "industry":             0-100,
    "fluidType":            0-100,
    "malaysiaState":        0-100,
    "siteEnvironment":      0-100,
    "application":          0-100,
    "budget":               0-100,
    "specialRequirements":  0-100,
    "scale":                0-100
  }
}

Confidence scoring rules:
- 90-100: explicitly stated in the document
- 70-89:  strongly implied by context
- 50-69:  reasonable inference but uncertain
- 0-49:   defaulted / guessed because the document doesn't say

OUTPUT FORMAT — non-negotiable:
Reply with ONE raw JSON object. First char "{", last char "}". No markdown fences, no prose, no comments. Must be JSON.parse-able.`;

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractJSON(raw: string): string {
  let s = raw.trim();
  const fenceMatch = s.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) s = fenceMatch[1].trim();
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }
  return s.trim();
}

async function callExtractor(text: string, cfg: ExtractorConfig): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const completion = await cfg.client.chat.completions.create(
      {
        model: cfg.model,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: `Extract project requirements from this document:\n\n${text}` },
        ],
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );
    const content = completion.choices[0]?.message?.content ?? '';
    return JSON.parse(extractJSON(content));
  } finally {
    clearTimeout(timer);
  }
}

// ─── Route ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pastedText = (formData.get('text') as string | null) ?? '';
    const file = formData.get('file') as File | null;

    let pdfText = '';
    if (file && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      // Dynamic import — unpdf is serverless-friendly (no DOM dependencies)
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
      const { text } = await extractText(pdf, { mergePages: true });
      pdfText = Array.isArray(text) ? text.join('\n') : (text ?? '');
      if (!pdfText.trim()) {
        return NextResponse.json(
          { error: 'No text found in PDF — it may be image-only / scanned. Try pasting the text directly.' },
          { status: 400 },
        );
      }
    }

    const combined = [pastedText, pdfText].filter(Boolean).join('\n\n').trim();
    if (!combined) {
      return NextResponse.json({ error: 'Provide pasted text or a PDF file.' }, { status: 400 });
    }
    if (combined.length > 50000) {
      // Truncate over-long docs to first 50k chars — extractor doesn't need everything
      console.warn(`[extract-requirements] input truncated from ${combined.length} to 50000 chars`);
    }

    const chain = buildExtractorChain();
    if (chain.length === 0) {
      return NextResponse.json({ error: 'No AI provider configured on the server.' }, { status: 500 });
    }

    let lastErr: unknown;
    for (const cfg of chain) {
      try {
        console.log(`[extract-requirements] trying ${cfg.provider}/${cfg.model}`);
        const result = await callExtractor(combined.slice(0, 50000), cfg);
        return NextResponse.json({ extracted: result, provider: cfg.provider });
      } catch (err) {
        lastErr = err;
        // Log the full error so we can see what each provider returned
        const msg = err instanceof Error ? err.message : String(err);
        const status = (err as { status?: number })?.status ?? '—';
        console.warn(`[extract-requirements] ${cfg.provider}/${cfg.model} failed (status=${status}): ${msg.slice(0, 200)}`);
        // ALWAYS continue to next provider — including 402, 429, 500, parse errors
        continue;
      }
    }
    // All providers exhausted — return a friendly message instead of leaking the AI's
    // "payment required" / "credit exhausted" raw error
    const lastMsg = lastErr instanceof Error ? lastErr.message : 'Unknown error';
    console.error('[extract-requirements] ALL providers failed. Last error:', lastMsg);
    return NextResponse.json(
      {
        error: 'All AI providers are currently unavailable. Please try again in a few minutes, or fill the form manually.',
        diagnostic: lastMsg.slice(0, 300),
      },
      { status: 503 },
    );
  } catch (err) {
    console.error('[extract-requirements]', err);
    const msg = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
