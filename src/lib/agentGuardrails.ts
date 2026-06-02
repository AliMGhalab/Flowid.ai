/**
 * Guardrails for the agentic generation pipeline.
 *
 * Two layers:
 *   1. INPUT guardrail — runs BEFORE any LLM call. Catches prompt injection
 *      attempts and out-of-scope requests. Returns reject reason or allows.
 *   2. OUTPUT guardrail — runs AFTER the agent finalises. Catches designs
 *      that violate safety rules (banned refrigerants, prohibited materials
 *      for the fluid, missing safety devices for hazardous services).
 *
 * Both fail SAFE — if a check is uncertain it allows with a warning rather
 * than blocking. Hard reject only for high-confidence violations.
 */

export interface GuardrailResult {
  allow: boolean;
  reason?: string;
  warnings: string[];
}

// ── Input guardrails ──────────────────────────────────────────────────────

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(your|all|the)\s+(system\s+)?(prompt|instructions|rules)/i,
  /you\s+are\s+(now|actually)\s+a/i,
  /forget\s+(everything|all|what).{0,30}told/i,
  /pretend\s+(you|to\s+be)/i,
  /reveal\s+(your|the)\s+(system\s+)?prompt/i,
  /print\s+(your|the)\s+instructions/i,
  /act\s+as\s+(if|though).{0,30}(no\s+)?(rules|restrictions)/i,
  /\[?\s*system\s*\]?\s*:\s*/i,  // "[SYSTEM]:" style injections
  /<\|im_start\|>/i,                // chat-template injections
  /<\|endoftext\|>/i,
];

const OUT_OF_SCOPE_KEYWORDS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(write|generate|compose|create)\s+(me\s+)?(a\s+)?(poem|song|story|joke|essay|article|novel|haiku)/i,
    reason: 'This is a fluid system engineering tool, not a writing assistant.' },
  { pattern: /\b(weapon|bomb|explosive|firearm|grenade|missile|warhead)/i,
    reason: 'Weapons design is outside the scope of this tool.' },
  { pattern: /\b(nuclear\s+reactor|fissile\s+material|enrichment\s+(of\s+)?uranium)/i,
    reason: 'Nuclear systems require specialised licensing beyond DOSH; this tool cannot assist.' },
  { pattern: /\b(drug\s+(synthesis|manufacture|cooking)|narcotics?|methamphetamine|cocaine)/i,
    reason: 'Illegal substance manufacturing is out of scope.' },
  { pattern: /\b(hack|exploit|penetration\s+test|sql\s+injection|xss|csrf)/i,
    reason: 'Security exploitation is out of scope for an engineering tool.' },
];

export function checkInputGuardrail(input: {
  application?: string;
  specialRequirements?: string;
  fluidType?: string;
  industry?: string;
  customFluidType?: string;
}): GuardrailResult {
  const warnings: string[] = [];
  // Concatenate all user-provided free-text fields
  const corpus = [
    input.application ?? '',
    input.specialRequirements ?? '',
    input.customFluidType ?? '',
    input.fluidType ?? '',
    input.industry ?? '',
  ].join('\n').trim();

  if (!corpus) {
    return { allow: false, reason: 'Empty input — provide a project description.', warnings };
  }

  // Hard rejects on prompt-injection patterns
  for (const re of INJECTION_PATTERNS) {
    if (re.test(corpus)) {
      return {
        allow: false,
        reason: 'Input contains prompt-injection patterns. This tool only accepts genuine engineering project descriptions.',
        warnings,
      };
    }
  }

  // Hard rejects on clearly out-of-scope requests
  for (const { pattern, reason } of OUT_OF_SCOPE_KEYWORDS) {
    if (pattern.test(corpus)) {
      return { allow: false, reason, warnings };
    }
  }

  // Soft warnings — allow but flag
  if (corpus.length < 20) {
    warnings.push('Application description is very short — output quality will be lower.');
  }
  if (corpus.length > 30000) {
    warnings.push('Input is unusually long — content beyond 30k chars will be summarised.');
  }

  return { allow: true, warnings };
}

// ── Output guardrails ─────────────────────────────────────────────────────

// Refrigerants banned or being phased out under Malaysian commitments to Montreal Protocol / Kigali Amendment
const BANNED_REFRIGERANTS = ['r22', 'r-22', 'hcfc-22', 'r-12', 'cfc-12', 'r113', 'r-113'];

interface RecommendationLike {
  components?: Array<{ name?: string; material?: string; specification?: string }>;
  risk_assessment?: { overall_risk_level?: string; risks?: unknown[] };
  cost_estimate?: { total_cost_myr?: number; equipment_cost_myr?: number };
}

export function checkOutputGuardrail(rec: RecommendationLike, fluid: string): GuardrailResult {
  const warnings: string[] = [];
  const components = rec.components ?? [];
  const fl = fluid.toLowerCase();

  // Check for banned refrigerants in component specs
  for (const c of components) {
    const text = `${c.name ?? ''} ${c.specification ?? ''}`.toLowerCase();
    for (const banned of BANNED_REFRIGERANTS) {
      if (text.includes(banned)) {
        return {
          allow: false,
          reason: `Component "${c.name}" specifies banned refrigerant "${banned.toUpperCase()}" — banned in Malaysia under Montreal Protocol commitments. Specify R-134a, R-410A, R-744 (CO₂), or R-717 (ammonia) instead.`,
          warnings,
        };
      }
    }
  }

  // Hazardous fluid systems must include safety components
  const isHazardous =
    fl.includes('acid') || fl.includes('caustic') || fl.includes('ammonia') ||
    fl.includes('hcl') || fl.includes('refrigerant') || fl.includes('lng') ||
    fl.includes('natural gas') || fl.includes('fuel');

  if (isHazardous) {
    const compText = components.map((c) => `${c.name ?? ''} ${c.specification ?? ''}`).join(' ').toLowerCase();
    if (!compText.includes('psv') && !compText.includes('pressure relief') && !compText.includes('safety valve')) {
      warnings.push('Hazardous fluid system but no Pressure Safety Valve (PSV) found in BOM. DOSH FMA 1967 requires PSV on all pressurised systems with hazardous fluids.');
    }
    if (fl.includes('acid') || fl.includes('caustic') || fl.includes('ammonia')) {
      if (!compText.includes('eyewash') && !compText.includes('safety shower')) {
        warnings.push('Corrosive/toxic fluid but no safety shower / eyewash in BOM — consider adding for personnel protection.');
      }
    }
  }

  // Cost integrity: component sum should match equipment_cost_myr (within 5%)
  const sum = components.reduce((s, c) => {
    const totalCost = (c as { total_cost_myr?: number }).total_cost_myr ?? 0;
    return s + totalCost;
  }, 0);
  const declared = rec.cost_estimate?.equipment_cost_myr ?? 0;
  if (sum > 0 && declared > 0 && Math.abs(sum - declared) / Math.max(sum, declared) > 0.05) {
    warnings.push(
      `Cost integrity: BOM sum RM ${sum.toLocaleString('en-MY')} differs from declared equipment cost RM ${declared.toLocaleString('en-MY')}. Reconciled server-side.`,
    );
  }

  return { allow: true, warnings };
}
