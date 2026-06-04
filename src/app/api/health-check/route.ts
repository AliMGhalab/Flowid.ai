import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 120;

const TINY_PROMPT = 'Reply with exactly this JSON and nothing else: {"ok":true}. /no_think';

interface ProviderResult {
  provider: string;
  model: string;
  status: 'ok' | 'fail';
  latency_ms?: number;
  error?: string;
}

async function testProvider(
  label: string,
  model: string,
  client: OpenAI,
  supportsJsonMode = false,
  timeoutMs = 20000,
): Promise<ProviderResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await client.chat.completions.create(
      {
        model,
        messages: [{ role: 'user', content: TINY_PROMPT }],
        max_tokens: 300,
        temperature: 0,
        ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
      },
      { signal: controller.signal },
    );
    clearTimeout(timer);
    const content = res.choices[0]?.message?.content ?? '';
    const latency_ms = Date.now() - start;
    // Verify we got something JSON-like back
    if (!content.includes('ok') && !content.includes('{')) {
      return { provider: label, model, status: 'fail', latency_ms, error: `Unexpected response: ${content.slice(0, 80)}` };
    }
    return { provider: label, model, status: 'ok', latency_ms };
  } catch (e) {
    clearTimeout(timer);
    const latency_ms = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    return { provider: label, model, status: 'fail', latency_ms, error: msg.slice(0, 150) };
  }
}

export async function GET() {
  const chutes = new OpenAI({ apiKey: process.env.CHUTES_API_KEY!, baseURL: 'https://llm.chutes.ai/v1', maxRetries: 0 });
  const zai    = new OpenAI({ apiKey: process.env.ZAI_API_KEY!, baseURL: 'https://api.z.ai/api/coding/paas/v4', maxRetries: 0 });
  const groq   = new OpenAI({ apiKey: process.env.GROQ_API_KEY!, baseURL: 'https://api.groq.com/openai/v1', maxRetries: 0 });
  const gemini = new OpenAI({ apiKey: process.env.GEMINI_API_KEY!, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', maxRetries: 0 });
  const mistral = new OpenAI({ apiKey: process.env.MISTRAL_API_KEY!, baseURL: 'https://api.mistral.ai/v1', maxRetries: 0 });
  const samba  = new OpenAI({ apiKey: process.env.SAMBANOVA_API_KEY!, baseURL: 'https://api.sambanova.ai/v1', maxRetries: 0 });

  const tests: Array<() => Promise<ProviderResult>> = [
    () => testProvider('groq-70b',       'llama-3.3-70b-versatile',            groq,    true,  15000),
    () => testProvider('groq-8b',        'llama-3.1-8b-instant',               groq,    true,  15000),
    () => testProvider('groq-gpt20b',    'openai/gpt-oss-20b',                 groq,    true,  15000),
    () => testProvider('gemini-2.5',     'gemini-2.5-flash',                   gemini,  true,  20000),
    () => testProvider('mistral-medium', 'mistral-medium-latest',              mistral, true,  20000),
    () => testProvider('samba-llama70b', 'Meta-Llama-3.3-70B-Instruct',        samba,   false, 20000),
    () => testProvider('samba-deepseek', 'DeepSeek-V3.2',                      samba,   false, 20000),
    () => testProvider('samba-maverick', 'Llama-4-Maverick-17B-128E-Instruct', samba,   false, 20000),
    () => testProvider('chutes-qwen397', 'Qwen/Qwen3.5-397B-A17B-TEE',         chutes,  false, 30000),
    () => testProvider('chutes-deepseek','deepseek-ai/DeepSeek-V3.2-TEE',      chutes,  false, 30000),
    () => testProvider('chutes-qwen32',  'Qwen/Qwen3-32B-TEE',                 chutes,  false, 30000),
    () => testProvider('chutes-qwen27',  'Qwen/Qwen3.6-27B-TEE',               chutes,  false, 30000),
    () => testProvider('chutes-minimax', 'MiniMaxAI/MiniMax-M2.5-TEE',         chutes,  false, 30000),
    () => testProvider('zai-glm5',       'glm-5.1',                             zai,     false, 20000),
  ];

  // Run all in parallel
  const results = await Promise.all(tests.map((fn) => fn()));

  const ok  = results.filter((r) => r.status === 'ok').length;
  const fail = results.filter((r) => r.status === 'fail').length;

  return NextResponse.json({ summary: `${ok} ok / ${fail} failed`, results });
}
