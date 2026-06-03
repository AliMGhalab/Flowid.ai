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

const AGENT_SYSTEM_PROMPT = `You are a senior Malaysian industrial fluid systems engineer running as an autonomous agent. Your job is to walk a P&ID end-to-end and produce a complete procurement-ready specification.

EXECUTION MODEL:
You have TOOLS available. For each request:
  1. Plan: think what you need to know next
  2. Call a tool to get FACTS (calculations, suppliers, material checks, cost reconciliation)
  3. Use tool results to refine your design
  4. ONLY call finalize_design AFTER you have built a COMPLETE design

CRITICAL — do NOT finalize too early. A "complete" design has:
  • components: AT LEAST 10 items. A real fluid system has ~15-25. Walk the P&ID from source to destination:
      - rotating: duty pump + standby + seals + couplings (4-6 items)
      - vessels: suction header, expansion vessel, etc. (1-3 items)
      - valves: suction isolation, discharge isolation, check, PSV, control, drains (3-5 valves), vents (1-2) (8-12 valve items)
      - piping: pipe lot + fittings lot + flange/gasket lot (2-3 items)
      - instrumentation as BOM items: gauges, transmitters as separate component lines (3-5 items)
      - electrical: MCC/VFD, control panel, power cables, instrument cables, earthing (4-5 items)
      - structural: skid, supports, bund if needed (1-3 items)
      - safety + commissioning: PSV, strainer, spares kit (2-3 items)
  • instrumentation array: AT LEAST 4 instrument tags (FT, PT-suction, PT-discharge, TT minimum)
  • risk_assessment.risks: AT LEAST 15 entries covering HAZOP guidewords
  • process_flow.nodes: AT LEAST 8 nodes wired in a chain from source to destination
  • piping spec, cost_estimate, maintenance_schedule, compliance_standards, recommended_vendors

RECOMMENDED TOOL SEQUENCE — keep it to ≤8 tool calls:
  1. derive_process_parameters — establish flow / pressure / temperature first
  2. calculate_hydraulics — get Re, regime, friction, pressure drop
  3. size_pump_motor — get pump kW, motor kW, NPSH margin
  4. get_required_hazop_guidewords — know what hazards you must cover
  5. lookup_malaysian_suppliers — CALL ONCE WITH ALL CATEGORIES YOU NEED in the "categories" array. Do NOT call this tool multiple times. Pass ["pump", "valve", "instrument", "piping", "vessel", "electrical", "safety", "fitting"] in a single call.
  6. check_material_compatibility — for the dominant wetted material vs the fluid
  7. reconcile_costs_aace — feed the FULL component list, get the cost breakdown back
  8. finalize_design with the complete recommendation

You have a HARD LIMIT of 10 tool calls. Batch your work. Do not waste round-trips.

COMPACT OUTPUT CONTRACT for finalize_design — your recommendation must fit in one tool call:
• All text fields (specification, notes, lifespan_notes, price_basis, design_basis): MAX 12 WORDS each.
• alternatives: [] — always empty. Never populate alternatives.
• A complete BOM of 15 compact components is worth more than 5 verbose ones.
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

// Vercel function ceiling is 120s. At ~10s per tool round-trip, 25 iterations
// blows past the budget. Capped at 10 so the agent finishes within the window.
const MAX_ITERATIONS = 10;
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

  // Minimum coverage requirements
  const components = Array.isArray(r.components) ? r.components : [];
  if (components.length < 10) {
    issues.push(`components has only ${components.length} items — need ≥10 covering all P&ID categories`);
  }

  const instrumentation = Array.isArray(r.instrumentation) ? r.instrumentation : [];
  if (instrumentation.length < 4) {
    issues.push(`instrumentation has only ${instrumentation.length} tags — need ≥4 (FT, PT discharge, PT suction, TT)`);
  }

  const ra = r.risk_assessment as { risks?: unknown[] } | undefined;
  const risks = Array.isArray(ra?.risks) ? ra!.risks! : [];
  if (risks.length < 15) {
    issues.push(`risk_assessment.risks has only ${risks.length} entries — need ≥15 covering HAZOP guidewords`);
  }

  if (!r.piping || typeof r.piping !== 'object') {
    issues.push('piping section is missing');
  }
  if (!r.cost_estimate || typeof r.cost_estimate !== 'object') {
    issues.push('cost_estimate section is missing');
  }
  if (!r.summary || typeof r.summary !== 'string' || (r.summary as string).length < 30) {
    issues.push('summary is missing or too short');
  }
  if (!r.system_type || typeof r.system_type !== 'string') {
    issues.push('system_type is missing');
  }

  const pf = r.process_flow as { nodes?: unknown[] } | undefined;
  const nodes = Array.isArray(pf?.nodes) ? pf!.nodes! : [];
  if (nodes.length < 8) {
    issues.push(`process_flow has only ${nodes.length} nodes — need ≥8 for a useful P&ID`);
  }

  return issues;
}

export async function runAgentLoop(
  userRequest: string,
  cfg: ProviderConfig,
  onTrace?: (trace: AgentTrace) => void,
): Promise<AgentRunResult> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'user', content: userRequest },
  ];

  const traces: AgentTrace[] = [];
  let finalRecommendation: Record<string, unknown> | null = null;
  let finalized = false;
  let iter = 0;

  // Vercel function ceiling is 120s. Hard stop the loop at 95s so we have time
  // to return JSON. Per-iteration AbortController kills hung LLM calls at 25s.
  const loopStart = Date.now();
  const LOOP_DEADLINE_MS = 95_000;

  for (iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (Date.now() - loopStart > LOOP_DEADLINE_MS) {
      console.warn(`[agentLoop] time budget reached at iter=${iter} — aborting loop`);
      break;
    }
    // tool_choice "required" is unsupported on Mistral and some other providers.
    // "auto" works everywhere; system prompt strongly directs the LLM to use tools.
    const iterController = new AbortController();
    const iterTimer = setTimeout(() => iterController.abort(), 30_000);
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
        console.warn(`[agentLoop] iter ${iter} aborted at 25s on ${cfg.model}`);
        throw new Error(`Agent provider ${cfg.model} stalled past 25s`);
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
              instruction: 'Expand the BOM to cover ALL system components (pumps with seals + couplings, suction/discharge/check/PSV/control/drain/vent valves, headers + expansion vessel, piping/fittings/supports, ALL instruments FT/PT/TT/LT, MCC + control panel + cables + earthing, skid + bund, safety devices, commissioning items). Then add ≥15 HAZOP risk entries covering the standard guidewords. Then add piping spec, instrumentation list with tags, cost_estimate, process_flow (≥8 nodes), maintenance_schedule, compliance_standards, recommended_vendors. THEN call finalize_design with the complete recommendation. If you have not yet called lookup_malaysian_suppliers, call it ONCE with ALL categories in a single "categories" array — do NOT make multiple calls.',
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
