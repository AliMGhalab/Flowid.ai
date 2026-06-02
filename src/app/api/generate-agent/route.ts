/**
 * /api/generate-agent — true agentic generation pipeline.
 *
 * Differs from /api/generate (which is a single LLM call with one mega-prompt):
 *   - The LLM dynamically chooses tools to call
 *   - Tools do REAL deterministic work (formulas, lookups, validations)
 *   - Loop continues until LLM calls finalize_design or hits iteration cap
 *   - Input guardrail catches prompt-injection / out-of-scope requests
 *   - Output guardrail validates final design against safety rules
 *
 * Returns the same JSON shape as /api/generate so downstream UI is unchanged.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ProjectInput } from '@/types';
import { runAgentLoop } from '@/lib/agentLoop';
import { checkInputGuardrail, checkOutputGuardrail } from '@/lib/agentGuardrails';

export const maxDuration = 120;

// ── Provider clients (DeepSeek V3 via Chutes is best at tool calling) ─────

function getChutesClient() {
  return new OpenAI({
    apiKey: process.env.CHUTES_API_KEY!,
    baseURL: 'https://llm.chutes.ai/v1',
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

interface AgentProvider {
  provider: string;
  model: string;
  client: OpenAI;
  max_tokens: number;
}

function buildAgentChain(): AgentProvider[] {
  const chain: AgentProvider[] = [];
  // GLM-5.1 via Chutes — best fit for tool calling, less hammered than DeepSeek
  if (process.env.CHUTES_API_KEY) {
    chain.push({ provider: 'chutes-glm',    model: 'zai-org/GLM-5.1-TEE',              client: getChutesClient(), max_tokens: 8000 });
    chain.push({ provider: 'chutes-qwen',   model: 'Qwen/Qwen3-32B-TEE',               client: getChutesClient(), max_tokens: 8000 });
    chain.push({ provider: 'chutes-deepseek', model: 'deepseek-ai/DeepSeek-V3.2-TEE',  client: getChutesClient(), max_tokens: 8000 });
  }
  // Mistral Large — Mistral-native fallback (different infra entirely)
  if (process.env.MISTRAL_API_KEY) {
    chain.push({ provider: 'mistral', model: 'mistral-large-latest', client: getMistralClient(), max_tokens: 8000 });
  }
  // SambaNova Llama 3.3 70B — final fallback (specialised hardware, different vendor)
  if (process.env.SAMBANOVA_API_KEY) {
    chain.push({ provider: 'sambanova', model: 'Meta-Llama-3.3-70B-Instruct', client: getSambaNovaClient(), max_tokens: 8000 });
  }
  // Cerebras intentionally excluded — Qwen-3 on Cerebras doesn't support tool
  // calling (404), gpt-oss-120b returns content in "reasoning" field. Cerebras
  // remains the primary provider for classic /api/generate only.
  return chain;
}

// ── User-input → agent user-request string ────────────────────────────────

function buildUserRequest(input: ProjectInput, fluidLabel: string): string {
  const state = (input.malaysiaState ?? 'selangor').replace(/_/g, ' ');
  const scale: string[] = [];
  if (input.scaleFlowRateValue) scale.push(`flow rate ${input.scaleFlowRateValue} ${input.scaleFlowRateUnit ?? ''}`);
  if (input.scaleVolumeMonthlyValue) scale.push(`monthly volume ${input.scaleVolumeMonthlyValue} ${input.scaleVolumeMonthlyUnit ?? ''}`);

  return `Design a complete industrial fluid system for the following project:

PROJECT NAME:       ${input.projectName}
INDUSTRY:           ${input.industry}
FLUID:              ${fluidLabel}
LOCATION:           ${state}, Malaysia
SITE ENVIRONMENT:   ${input.siteEnvironment}
BUDGET:             RM ${input.budget.toLocaleString('en-MY')}
SCALE:              ${scale.length ? scale.join(' · ') : 'not specified — estimate from application'}
SPECIAL REQUIREMENTS: ${input.specialRequirements || 'none'}

APPLICATION:
${input.application}

Use your tools to derive process parameters, compute hydraulics, look up real Malaysian suppliers, verify material compatibility, audit HAZOP coverage, and reconcile costs. When the design is complete, call finalize_design with the full recommendation. Begin.`;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const input: ProjectInput = await request.json();

    // INPUT GUARDRAIL
    const inputGuard = checkInputGuardrail(input);
    if (!inputGuard.allow) {
      return NextResponse.json(
        { error: `Request rejected by input guardrail: ${inputGuard.reason}` },
        { status: 400 },
      );
    }

    const fluidLabel = input.customFluidType?.trim() || (input.fluidType ?? '').replace(/_/g, ' ');
    const userRequest = buildUserRequest(input, fluidLabel);

    const chain = buildAgentChain();
    if (chain.length === 0) {
      return NextResponse.json({ error: 'No AI provider configured.' }, { status: 500 });
    }

    let lastError: unknown;
    for (const cfg of chain) {
      try {
        console.log(`[/api/generate-agent] starting agent on ${cfg.provider}/${cfg.model}`);
        const result = await runAgentLoop(userRequest, cfg);

        if (!result.finalized || !result.recommendation) {
          console.warn(`[/api/generate-agent] agent on ${cfg.model} did not finalize (used ${result.iterations_used} iterations) — trying next provider`);
          continue;
        }

        // OUTPUT GUARDRAIL
        const outputGuard = checkOutputGuardrail(result.recommendation, fluidLabel);
        if (!outputGuard.allow) {
          console.warn(`[/api/generate-agent] output guardrail rejected on ${cfg.model}: ${outputGuard.reason} — trying next provider`);
          lastError = new Error(outputGuard.reason ?? 'Output rejected');
          continue;
        }

        // Attach trace + warnings for the UI
        const recWithMeta: Record<string, unknown> = {
          ...result.recommendation,
          agent_trace: {
            iterations: result.iterations_used,
            traces: result.traces,
            provider: result.provider,
            model: result.model,
            guardrail_warnings: [...inputGuard.warnings, ...outputGuard.warnings],
          },
        };

        console.log(`[/api/generate-agent] success on ${cfg.provider}/${cfg.model} in ${result.iterations_used} iterations`);
        return NextResponse.json({
          recommendation: recWithMeta,
          agent_meta: {
            iterations: result.iterations_used,
            provider: result.provider,
            warnings: outputGuard.warnings,
          },
        });
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[/api/generate-agent] ${cfg.provider}/${cfg.model} failed: ${msg.slice(0, 200)} — trying next provider`);
        continue;
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : 'All agent providers failed';
    return NextResponse.json(
      {
        error: 'Agent pipeline could not complete the design. Falling back to classic /api/generate is recommended.',
        diagnostic: errMsg.slice(0, 300),
      },
      { status: 503 },
    );
  } catch (err) {
    console.error('[/api/generate-agent] fatal:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Agent pipeline failed' },
      { status: 500 },
    );
  }
}
