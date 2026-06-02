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

const AGENT_SYSTEM_PROMPT = `You are a senior Malaysian industrial fluid systems engineer running as an autonomous agent.

You have access to a set of TOOLS (see the tools list). For each request, you must:
  1. Reason about which tool to call next based on what information you still need
  2. Call tools to get FACTS (calculations, supplier lookups, material checks)
  3. Use the tool results to refine your design
  4. When the design is complete, call \`finalize_design\` with the full FluidSystemRecommendation

Rules:
  - Always call \`derive_process_parameters\` first to establish flow rate, pressure, temperature.
  - Always call \`get_required_hazop_guidewords\` before writing the risk register.
  - Always call \`check_material_compatibility\` if you specify any material for a chemical / corrosive / refrigerant fluid.
  - Always call \`reconcile_costs_aace\` with the BOM components before finalizing — let server-side math compute the cost breakdown, not your own arithmetic.
  - Call \`lookup_malaysian_suppliers\` at least once per component category to ground supplier names in reality.
  - You have a maximum of 15 tool calls. Use them efficiently.
  - When finalising, the recommendation must include: summary, system_type, design_basis, overall_confidence, process_parameters, engineering_calculations, components (≥ 10 items), piping, instrumentation (≥ 4 tags), risk_assessment (≥ 15 entries), maintenance_schedule, cost_estimate, process_flow, recommended_vendors, compliance_standards.
  - In finalize_design.recommendation, use EXACTLY the field names listed above.
  - Components must each have id, name, category, quantity, specification, material, supplier, model, unit_cost_myr, total_cost_myr, notes.
  - Output language is English. All monetary values in MYR. Use Malaysian regulations (DOSH FMA 1967, BOMBA UBBL, SIRIM, PETRONAS PTS, MS Standards) where applicable.

You are an AGENT, not a static prompt. Reason about what you need, call tools to get it, then act. Do not hallucinate facts you can verify with a tool.`;

const MAX_ITERATIONS = 15;
const MAX_TOOL_RESULT_SIZE = 12000; // chars — truncate huge tool outputs

function truncate(s: string, max = MAX_TOOL_RESULT_SIZE): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…(truncated ${s.length - max} chars)`;
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

  for (iter = 0; iter < MAX_ITERATIONS; iter++) {
    const completion = await cfg.client.chat.completions.create({
      model: cfg.model,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: iter === 0 ? 'required' : 'auto',
      max_tokens: cfg.max_tokens ?? 8000,
      temperature: 0.1,
    });

    const msg = completion.choices[0]?.message;
    if (!msg) break;

    // No tool calls → model wants to finalise via text. Push it and try to coerce next round.
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      messages.push({ role: 'assistant', content: msg.content ?? '' });
      // If we've run a fair number of iterations, accept the text and stop
      if (iter >= 2) {
        // No finalize_design called — treat as failure
        break;
      }
      messages.push({
        role: 'user',
        content: 'You must call a tool. If the design is complete, call finalize_design with the full recommendation. Otherwise call the next tool you need.',
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

      // Special: finalize_design ends the loop
      if (fnName === 'finalize_design') {
        const rec = (args as { recommendation?: Record<string, unknown> })?.recommendation;
        if (rec && typeof rec === 'object') {
          finalRecommendation = rec;
          finalized = true;
        }
        trace.tool_calls.push({ name: fnName, args, result: { status: 'finalized' } });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ status: 'design finalised — loop ending' }),
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
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
