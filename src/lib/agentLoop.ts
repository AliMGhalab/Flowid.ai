/**
 * agentLoop.ts — true agentic reasoning loop.
 *
 * The LLM is given a goal and a set of tools. It decides which tool to
 * call, sees the result, decides the next action, and continues until it
 * calls `finalize_design` (or hits the iteration ceiling).
 *
 * This is OpenAI function-calling / Anthropic tool-use against any
 * OpenAI-compatible endpoint. Works with Cerebras, Mistral, SambaNova, Chutes.
 */

import OpenAI from 'openai';
import { AGENT_TOOLS, runTool } from './agentTools';

export interface AgentTrace {
  iteration: number;
  tool_calls: Array<{ name: string; args: unknown; result: unknown }>;
  reasoning?: string;
}

export interface AgentRunResult {
  recommendation: Record<string, unknown> | null;
  traces: AgentTrace[];
  iterations_used: number;
  finalized: boolean;
  provider: string;
  model: string;
}

interface ProviderConfig {
  provider: string;
  model: string;
  client: OpenAI;
  max_tokens?: number;
}

const AGENT_SYSTEM_PROMPT = `You are a senior Malaysian industrial fluid systems engineer running as an autonomous agent. Your job is to walk a P&ID end-to-end and produce a complete procurement-ready specification. /no_think

EXECUTION MODEL — FAST PATH (3 tool calls max):
  1. lookup_malaysian_suppliers — call ONCE with ALL categories: ["pump","valve","instrument","piping","vessel","electrical","safety","fitting"]. Use supplier names and price ranges in your BOM.
  2. reconcile_costs_aace — feed your complete component list to get the verified cost breakdown.
  3. finalize_design — call this with the COMPLETE recommendation. Do NOT call any other tools.

You already know how to: derive process parameters, calculate hydraulics, size pumps, run HAZOP — do all of that IN YOUR HEAD and put the results directly into finalize_design. Only use tools for supplier lookup and cost reconciliation.

COMPACT OUTPUT CONTRACT for finalize_design:
• All text fields (specification, notes, lifespan_notes, price_basis, design_basis): MAX 12 WORDS each.
• components: include 1-2 alternatives per component (brand options, different materials).
• Keep risks terse: hazard + cause (1 phrase each). Keep process_flow node labels short (≤4 words).

OUTPUT FIELD NAMES in finalize_design.recommendation:
  summary, system_type, design_basis, overall_confidence, process_parameters, engineering_calculations,
  process_flow (nodes + edges), components (id/name/category/quantity/specification/material/supplier/model/unit_cost_myr/total_cost_myr/notes/confidence_level/lifespan_years/price_basis),
  piping (material/nominal_diameter_inch/schedule/connection_type/insulation_required/design_notes),
  instrumentation (tag/description/type/service/range/material/supplier/unit_cost_myr),
  risk_assessment (overall_risk_level/hazop_summary/risks[]), maintenance_schedule, compliance_standards,
  cost_estimate (equipment/transportation/installation/engineering/commissioning/total/within_budget/budget_notes),
  lead_time_weeks, recommended_vendors, engineering_notes.

Language: English. Money: MYR. Standards: DOSH FMA 1967, BOMBA UBBL, SIRIM, PETRONAS PTS, MS Standards.

You are an AGENT. Do the work. Do not shortcut the BOM.`;

// Vercel ceiling = 120s. Qwen3.5-397B takes ~12s/iteration.
// 8 iterations × 12s = 96s + overhead = safe within 120s.
const MAX_ITERATIONS = 8;
const MAX_TOOL_RESULT_SIZE = 20000; // chars — finalize_design JSON can be 10-15k; keep it intact

function truncate(s: string, max = MAX_TOOL_RESULT_SIZE): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…(truncated ${s.length - max} chars)`;
}

// Verifies the agent's proposed final recommendation. If empty array, the
// recommendation is complete enough to accept; otherwise the array lists
// what's missing so the agent can fix it on the next iteration.
function validateAgentRecommendation(rec: unknown): string[] {
  const issues: string[] = [];
  if (!rec || typeof rec !== 'object') {
    return ['recommendation must be an object'];
  }
  const r = rec as Record<string, unknown>;

  // Minimum coverage requirements — kept low so the agent can finalize without
  // burning all iterations on rejection loops. Quality checks run server-side after.
  const components = Array.isArray(r.components) ? r.components : [];
  if (components.length < 5) {
    issues.push(`components has only ${components.length} items — need ≥5`);
  }

  if (!r.summary || typeof r.summary !== 'string' || (r.summary as string).length < 10) {
    issues.push('summary is missing');
  }
  if (!r.system_type || typeof r.system_type !== 'string') {
    issues.push('system_type is missing');
  }

  return issues;
}

export async function runAgentLoop(
  userRequest: string,
  cfg: ProviderConfig,
  onTrace?: (trace: AgentTrace) => void,
  providerBudgetMs = 35_000, // each provider gets this much time before we give up on it
): Promise<AgentRunResult> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'user', content: userRequest },
  ];

  const traces: AgentTrace[] = [];
  let finalRecommendation: Record<string, unknown> | null = null;
  let finalized = false;
  let iter = 0;

  const loopStart = Date.now();
  const LOOP_DEADLINE_MS = providerBudgetMs;

  for (iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (Date.now() - loopStart > LOOP_DEADLINE_MS) {
      console.warn(`[agentLoop] time budget reached at iter=${iter} — aborting loop`);
      break;
    }
    // tool_choice "required" is unsupported on Mistral and some other providers.
    // "auto" works everywhere; system prompt strongly directs the LLM to use tools.
    const iterController = new AbortController();
    const iterTimer = setTimeout(() => iterController.abort(), 28_000); // 28s per iteration — large TEE models need up to 25s cold start
    let completion;
    try {
      completion = await cfg.client.chat.completions.create(
        {
          model: cfg.model,
          messages,
          tools: AGENT_TOOLS,
          tool_choice: 'auto',
          max_tokens: cfg.max_tokens ?? 8000,
          temperature: 0.1,
        },
        { signal: iterController.signal },
      );
    } catch (e) {
      clearTimeout(iterTimer);
      if (iterController.signal.aborted) {
        const elapsed = Date.now() - loopStart;
        console.warn(`[agentLoop] iter ${iter} aborted at ${Math.round(elapsed / 1000)}s on ${cfg.model}`);
        throw new Error(`Agent provider ${cfg.model} stalled past ${Math.round(elapsed / 1000)}s`);
      }
      throw e;
    }
    clearTimeout(iterTimer);

    const msg = completion.choices[0]?.message;
    if (!msg) break;

    // No tool calls → model wants to finalise via text. Push it back every iteration
    // until we hit the ceiling (we never accept a text-only response as a valid finalize).
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      messages.push({ role: 'assistant', content: msg.content ?? '' });
      if (iter >= MAX_ITERATIONS - 1) {
        // Last chance — treat as failure
        break;
      }
      messages.push({
        role: 'user',
        content: 'You MUST call a tool. Do NOT return plain text. If the design is complete, call finalize_design with the full recommendation object. Otherwise call the next tool in the sequence.',
      });
      continue;
    }

    // Record the assistant message including tool_calls
    messages.push({
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    } as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    const trace: AgentTrace = { iteration: iter, tool_calls: [], reasoning: msg.content ?? undefined };

    // Execute each tool call
    for (const call of msg.tool_calls) {
      if (call.type !== 'function') continue;
      const fnName = call.function.name;
      let args: unknown = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }

      // Special: finalize_design — but ONLY accept if the recommendation is complete.
      // If the agent tries to finalize prematurely, reject and tell it what's missing.
      if (fnName === 'finalize_design') {
        // Accept both shapes: { recommendation: {...} }  OR  the recommendation fields at the top level
        const argsObj = args as Record<string, unknown>;
        const nested = argsObj?.recommendation;
        const rec =
          nested && typeof nested === 'object'
            ? (nested as Record<string, unknown>)
            : argsObj && typeof argsObj === 'object' && 'components' in argsObj
              ? argsObj
              : undefined;
        const issues = validateAgentRecommendation(rec);
        console.log(`[agentLoop] finalize_design called — components=${Array.isArray((rec as { components?: unknown[] })?.components) ? ((rec as { components?: unknown[] }).components!).length : 0}, issues=${issues.length}`);
        if (issues.length === 0 && rec) {
          finalRecommendation = rec as Record<string, unknown>;
          finalized = true;
          trace.tool_calls.push({ name: fnName, args, result: { status: 'finalized' } });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ status: 'design finalised — loop ending' }),
          } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
        } else {
          // Reject the premature finalize and tell the agent to keep working
          trace.tool_calls.push({ name: fnName, args: { _summary: 'premature finalize' }, result: { status: 'rejected', issues } });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              status: 'REJECTED — your recommendation is incomplete. Do not call finalize_design yet.',
              issues,
              instruction: 'Add more components to the BOM (need ≥5), ensure summary and system_type are present, then call finalize_design again.',
            }),
          } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
        }
        continue;
      }

      const result = runTool(fnName, args);
      trace.tool_calls.push({ name: fnName, args, result });

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: truncate(JSON.stringify(result)),
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
    }

    traces.push(trace);
    onTrace?.(trace);

    if (finalized) break;
  }

  return {
    recommendation: finalRecommendation,
    traces,
    iterations_used: iter + 1,
    finalized,
    provider: cfg.provider,
    model: cfg.model,
  };
}
