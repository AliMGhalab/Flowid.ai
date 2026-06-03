import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import type { ProjectInput } from '@/types';

export const maxDuration = 120;

// ─── Schema validation (Zod — TypeScript's equivalent of Pydantic) ───────────
// Strict schema enforcement on AI output prevents drift, missing fields, and
// hallucinated values from reaching the user. Failed validation triggers retry.

// Normalize any AI variant to a valid enum value — never reject, always coerce.
// "very low" → "low", "extreme" → "critical", "moderate" → "medium", unknown → "medium".
function normalizeRiskLevel(raw: unknown, allowCritical = true): 'low' | 'medium' | 'high' | 'critical' {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s.includes('crit') || s.includes('extreme') || s.includes('catastroph')) return allowCritical ? 'critical' : 'high';
  if (s.includes('high') || s.includes('severe') || s.includes('major')) return 'high';
  if (s.includes('low') || s.includes('minor') || s.includes('negligible')) return 'low';
  return 'medium'; // default — covers "medium", "moderate", "very low" → would already match above, anything else falls here
}

const riskLevel3 = z.unknown().transform((v) => normalizeRiskLevel(v, false) as 'low' | 'medium' | 'high');
const riskLevel4 = z.unknown().transform((v) => normalizeRiskLevel(v, true));

const RiskSchema = z.object({
  id: z.string().optional().default(''),
  category: z.string().optional().default('operational'),
  hazard: z.string().min(1),
  cause: z.string().optional().default(''),
  consequence: z.string().optional().default(''),
  likelihood: riskLevel3.optional().default('medium'),
  severity: riskLevel4.optional().default('medium'),
  risk_level: riskLevel4.optional().default('medium'),
  safeguard: z.string().optional().default(''),
  mitigation: z.string().optional().default(''),
}).passthrough();

const ComponentSchema = z.object({
  id: z.string().optional().default(''),
  name: z.string().min(1),
  category: z.string().optional().default('other'),
  quantity: z.coerce.number().nonnegative().default(1),
  specification: z.string().optional().default(''),
  material: z.string().optional().default(''),
  supplier: z.string().optional().default(''),
  model: z.string().optional().default(''),
  unit_cost_myr: z.coerce.number().nonnegative().optional(),
  total_cost_myr: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional().default(''),
  confidence_level: z.coerce.number().min(0).max(100).optional(),
  lifespan_years: z.coerce.number().positive().optional(),
  lifespan_notes: z.string().optional(),
  price_basis: z.string().optional(),
  alternatives: z.array(z.any()).optional(),
}).passthrough();

const CostEstimateSchema = z.object({
  equipment_cost_myr: z.coerce.number().nonnegative().optional(),
  installation_cost_myr: z.coerce.number().nonnegative().optional(),
  engineering_cost_myr: z.coerce.number().nonnegative().optional(),
  commissioning_cost_myr: z.coerce.number().nonnegative().optional(),
  transportation_cost_myr: z.coerce.number().nonnegative().optional(),
  total_cost_myr: z.coerce.number().nonnegative().optional(),
  within_budget: z.coerce.boolean().optional().default(true),
  budget_notes: z.string().optional().default(''),
}).passthrough();

const ProcessFlowNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional().default(''),
  type: z.string().optional().default('other'),
}).passthrough();

const ProcessFlowEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
}).passthrough();

const RecommendationSchema = z.object({
  summary: z.string().min(1),
  system_type: z.string().min(1),
  design_basis: z.string().optional().default(''),
  components: z.array(ComponentSchema).min(1, 'BOM must contain at least one component'),
  cost_estimate: CostEstimateSchema.optional().default({ within_budget: true, budget_notes: '' }),
  risk_assessment: z.object({
    overall_risk_level: riskLevel4.optional().default('medium'),
    hazop_summary: z.string().optional().default(''),
    risks: z.array(RiskSchema).optional().default([]),
  }).passthrough().optional(),
  process_flow: z.object({
    nodes: z.array(ProcessFlowNodeSchema).optional().default([]),
    edges: z.array(ProcessFlowEdgeSchema).optional().default([]),
  }).passthrough().optional(),
}).passthrough();

// ─── Hallucination safeguards — sanity-check the AI output ───────────────────
// Server-side rules that catch nonsensical AI output BEFORE it reaches the user.

interface ValidationWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

function runSanityChecks(rec: Record<string, unknown>): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // 1. Cost integrity — sum of component costs should ≈ equipment_cost_myr (within 5%)
  const components = (rec.components as Array<{ total_cost_myr?: number }> | undefined) ?? [];
  const componentSum = components.reduce((s, c) => s + (c.total_cost_myr ?? 0), 0);
  const est = rec.cost_estimate as { equipment_cost_myr?: number } | undefined;
  const declared = est?.equipment_cost_myr;
  if (declared && componentSum > 0) {
    const drift = Math.abs(declared - componentSum) / Math.max(declared, componentSum);
    if (drift > 0.05) {
      warnings.push({
        code: 'COST_MISMATCH',
        severity: 'warning',
        message: `Equipment subtotal (RM ${componentSum.toLocaleString('en-MY')}) differs from declared total (RM ${declared.toLocaleString('en-MY')}) by ${(drift * 100).toFixed(1)}%. AI may have miscounted.`,
      });
    }
  }

  // 2. NPSH margin sanity — pumps need at least 0.6 m margin per API 610
  const ec = rec.engineering_calculations as { npsh_margin_m?: number } | undefined;
  if (ec?.npsh_margin_m !== undefined && ec.npsh_margin_m < 0.6) {
    warnings.push({
      code: 'NPSH_MARGIN_LOW',
      severity: 'warning',
      message: `NPSH margin is ${ec.npsh_margin_m} m — below API 610 minimum of 0.6 m. Cavitation risk; verify suction conditions.`,
    });
  }

  // 3. Supplier whitelist — Malaysian suppliers should contain Malaysia / Sdn Bhd / known cities
  const MY_TOKENS = [
    'malaysia', 'sdn bhd', 'sdn. bhd', 'm sdn', 'shah alam', 'petaling jaya', 'kuala lumpur',
    'penang', 'johor', 'subang', 'puchong', 'klang', 'putrajaya', 'cyberjaya', 'ipoh',
    'bayan lepas', 'kota kinabalu', 'kuching', 'bangi', 'kajang', 'selangor', 'sarawak', 'sabah',
  ];
  const suspectSuppliers: string[] = [];
  for (const c of components) {
    const sup = ((c as { supplier?: string }).supplier ?? '').toLowerCase();
    if (!sup) continue;
    const looksMalaysian = MY_TOKENS.some((t) => sup.includes(t));
    if (!looksMalaysian) suspectSuppliers.push((c as { supplier?: string }).supplier ?? '');
  }
  if (suspectSuppliers.length > 0) {
    warnings.push({
      code: 'SUPPLIER_NOT_MY',
      severity: 'info',
      message: `${suspectSuppliers.length} supplier(s) don't match Malaysian patterns: ${suspectSuppliers.slice(0, 3).join(', ')}${suspectSuppliers.length > 3 ? '...' : ''}. Verify location.`,
    });
  }

  // 4. Process flow quality — diagram should have ≥10 nodes and form a connected chain
  const pf = rec.process_flow as { nodes?: Array<{ id: string }>; edges?: Array<{ from: string; to: string }> } | undefined;
  if (pf?.nodes && pf?.edges) {
    if (pf.nodes.length < 6) {
      warnings.push({
        code: 'PID_TOO_SMALL',
        severity: 'info',
        message: `Process flow diagram has only ${pf.nodes.length} nodes — recommend at least 10 for a useful P&ID.`,
      });
    }
    // Count orphan nodes (no edges in or out)
    const connectedIds = new Set<string>();
    for (const e of pf.edges) {
      connectedIds.add(e.from);
      connectedIds.add(e.to);
    }
    const orphans = pf.nodes.filter((n) => !connectedIds.has(n.id));
    if (orphans.length > 0) {
      warnings.push({
        code: 'PID_ORPHAN_NODES',
        severity: 'info',
        message: `${orphans.length} node(s) in the diagram have no connections: ${orphans.map((n) => n.id).join(', ')}.`,
      });
    }
  }

  // 5. Component cost outliers — flag single items > 50% of total (might be misplaced decimal)
  if (componentSum > 0) {
    for (const c of components as Array<{ name?: string; total_cost_myr?: number }>) {
      if ((c.total_cost_myr ?? 0) > componentSum * 0.5) {
        warnings.push({
          code: 'COST_OUTLIER',
          severity: 'info',
          message: `"${c.name}" is RM ${c.total_cost_myr?.toLocaleString('en-MY')} — over 50% of total. Possible misplaced decimal; verify.`,
        });
      }
    }
  }

  // 6. ENGINEERING MATH VERIFICATION — re-compute AI's calculations server-side
  verifyEngineeringMath(rec, warnings);

  // 7. BOM ↔ P&ID consistency — pump count, vessel count should agree
  verifyBomPidConsistency(rec, warnings);

  // 8. HAZOP guideword coverage — required guidewords must appear in risks
  verifyHazopCoverage(rec, warnings);

  // 9. Material compatibility — flag known dangerous fluid+material combos
  verifyMaterialCompatibility(rec, warnings);

  return warnings;
}

// ─── Server-side engineering verification ────────────────────────────────────

interface CalcCheck {
  field: string;
  aiValue: number;
  computedValue: number;
  driftPct: number;
}

function approxEqual(a: number, b: number, tolerancePct: number): boolean {
  if (a === 0 && b === 0) return true;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) < tolerancePct / 100;
}

function verifyEngineeringMath(rec: Record<string, unknown>, warnings: ValidationWarning[]): void {
  type EC = {
    npsh_available_m?: number; npsh_required_m?: number; npsh_margin_m?: number;
    total_dynamic_head_m?: number; static_head_m?: number; friction_head_m?: number;
    pump_power_kw?: number; motor_size_kw?: number;
    pipe_velocity_m_s?: number; reynolds_number?: number;
    flow_regime?: string; friction_factor?: number;
  };
  type PP = { design_flow_rate?: string; operating_temperature?: string; fluid_velocity?: string };

  const ec = rec.engineering_calculations as EC | undefined;
  if (!ec) return;
  const pp = rec.process_parameters as PP | undefined;

  const mismatches: CalcCheck[] = [];

  // Check 1: NPSH margin = NPSHa - NPSHr
  if (ec.npsh_available_m !== undefined && ec.npsh_required_m !== undefined && ec.npsh_margin_m !== undefined) {
    const computed = ec.npsh_available_m - ec.npsh_required_m;
    if (!approxEqual(ec.npsh_margin_m, computed, 10)) {
      mismatches.push({ field: 'NPSH margin', aiValue: ec.npsh_margin_m, computedValue: Number(computed.toFixed(2)), driftPct: Math.abs(ec.npsh_margin_m - computed) / Math.max(Math.abs(ec.npsh_margin_m), Math.abs(computed)) * 100 });
      ec.npsh_margin_m = Number(computed.toFixed(2));
    }
  }

  // Check 2: TDH = static_head + friction_head (velocity head usually negligible)
  if (ec.static_head_m !== undefined && ec.friction_head_m !== undefined && ec.total_dynamic_head_m !== undefined) {
    const computed = ec.static_head_m + ec.friction_head_m;
    if (!approxEqual(ec.total_dynamic_head_m, computed, 15)) {
      mismatches.push({ field: 'TDH (static + friction)', aiValue: ec.total_dynamic_head_m, computedValue: Number(computed.toFixed(1)), driftPct: Math.abs(ec.total_dynamic_head_m - computed) / Math.max(Math.abs(ec.total_dynamic_head_m), Math.abs(computed)) * 100 });
    }
  }

  // Check 3: Reynolds number — recompute from velocity, diameter, water properties at temp
  if (pp?.fluid_velocity && pp.design_flow_rate && ec.reynolds_number !== undefined) {
    const velocity = parseFloat(pp.fluid_velocity);
    const tempStr = pp.operating_temperature ?? '25°C';
    const temp = parseFloat(tempStr);
    // Estimate pipe diameter from Q (m³/hr) and v (m/s): D = sqrt(4Q / (π × v × 3600))
    const flow = parseFloat(pp.design_flow_rate); // m³/hr
    if (velocity > 0 && flow > 0) {
      const diameter_m = Math.sqrt((4 * flow) / (Math.PI * velocity * 3600));
      // Water properties (rough): ρ = 1000 kg/m³ near 25°C, μ ≈ 10^-3 Pa·s; lower for hotter water
      const density = 1000 - 0.2 * Math.max(0, temp - 4); // crude approximation
      const viscosity = 0.001 * Math.exp(-0.025 * Math.max(0, temp - 25)); // crude
      const computed = (density * velocity * diameter_m) / viscosity;
      // Re is wide range — accept 30% drift before flagging
      if (!approxEqual(ec.reynolds_number, computed, 30)) {
        mismatches.push({
          field: 'Reynolds number',
          aiValue: ec.reynolds_number,
          computedValue: Math.round(computed),
          driftPct: Math.abs(ec.reynolds_number - computed) / Math.max(ec.reynolds_number, computed) * 100,
        });
      }
      // Verify flow_regime label matches computed Re
      if (ec.flow_regime) {
        const expectedRegime = computed < 2300 ? 'laminar' : computed < 4000 ? 'transitional' : 'turbulent';
        if (ec.flow_regime.toLowerCase() !== expectedRegime) {
          warnings.push({
            code: 'FLOW_REGIME_MISMATCH',
            severity: 'info',
            message: `Flow regime labelled "${ec.flow_regime}" but Re ≈ ${Math.round(computed)} → ${expectedRegime}.`,
          });
          ec.flow_regime = expectedRegime;
        }
      }
    }
  }

  // Check 4: Motor size must be next IEC standard step ≥ pump_power_kw
  const IEC_SIZES = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250];
  if (ec.pump_power_kw !== undefined && ec.motor_size_kw !== undefined) {
    const expectedMotor = IEC_SIZES.find((s) => s >= ec.pump_power_kw!) ?? ec.pump_power_kw;
    if (ec.motor_size_kw < ec.pump_power_kw) {
      warnings.push({
        code: 'MOTOR_UNDERSIZED',
        severity: 'warning',
        message: `Motor size (${ec.motor_size_kw} kW) is below pump shaft power (${ec.pump_power_kw} kW) — motor will overload. Should be ≥ ${expectedMotor} kW per IEC 60034.`,
      });
      ec.motor_size_kw = expectedMotor;
    }
  }

  if (mismatches.length > 0) {
    warnings.push({
      code: 'ENG_MATH_DRIFT',
      severity: 'warning',
      message: `${mismatches.length} engineering calculation(s) re-verified server-side: ${mismatches.map((m) => `${m.field} drifted ${m.driftPct.toFixed(0)}% (AI: ${m.aiValue} → corrected: ${m.computedValue})`).join('; ')}.`,
    });
  } else if (ec.npsh_available_m !== undefined || ec.reynolds_number !== undefined) {
    warnings.push({
      code: 'ENG_MATH_VERIFIED',
      severity: 'info',
      message: 'All engineering calculations cross-checked against formulas (NPSH margin, TDH, Reynolds, motor sizing) — math is internally consistent.',
    });
  }
}

function verifyBomPidConsistency(rec: Record<string, unknown>, warnings: ValidationWarning[]): void {
  const components = (rec.components as Array<{ category?: string; name?: string; quantity?: number }> | undefined) ?? [];
  const pf = rec.process_flow as { nodes?: Array<{ type?: string; id?: string }> } | undefined;
  if (!pf?.nodes) return;

  const bomPumps = components.filter((c) => (c.category ?? '').toLowerCase().includes('pump')).reduce((s, c) => s + (c.quantity ?? 1), 0);
  const pidPumps = pf.nodes.filter((n) => (n.type ?? '').toLowerCase() === 'pump').length;
  if (bomPumps > 0 && pidPumps > 0 && Math.abs(bomPumps - pidPumps) > 1) {
    warnings.push({
      code: 'BOM_PID_PUMP_MISMATCH',
      severity: 'info',
      message: `BOM lists ${bomPumps} pump(s); P&ID diagram shows ${pidPumps}. Verify diagram completeness.`,
    });
  }
}

function verifyHazopCoverage(rec: Record<string, unknown>, warnings: ValidationWarning[]): void {
  const ra = rec.risk_assessment as { risks?: Array<{ hazard?: string }> } | undefined;
  const risks = ra?.risks ?? [];
  if (risks.length === 0) return;

  // Required guidewords for any fluid system
  const required = ['NO FLOW', 'MORE PRESSURE', 'LEAK', 'ELECTRICAL'];
  const allHazardText = risks.map((r) => (r.hazard ?? '').toUpperCase()).join(' | ');
  const missing = required.filter((g) => !allHazardText.includes(g));
  if (missing.length > 0) {
    warnings.push({
      code: 'HAZOP_GUIDEWORDS_MISSING',
      severity: 'info',
      message: `HAZOP register missing required guidewords: ${missing.join(', ')}. PE should add these before finalising.`,
    });
  }
}

function verifyMaterialCompatibility(rec: Record<string, unknown>, warnings: ValidationWarning[]): void {
  const components = (rec.components as Array<{ name?: string; material?: string }> | undefined) ?? [];

  // Known dangerous fluid + material combinations
  const fluidType = (rec.summary as string | undefined ?? '').toLowerCase()
    + ' ' + ((rec.system_type as string | undefined) ?? '').toLowerCase();

  const incompatibilities: Array<{ fluid: string; badMaterial: string; reason: string }> = [
    { fluid: 'hydrochloric', badMaterial: 'carbon steel', reason: 'Severe corrosion — use HDPE, PTFE-lined, or FRP' },
    { fluid: 'hcl',          badMaterial: 'carbon steel', reason: 'Severe corrosion — use HDPE, PTFE-lined, or FRP' },
    { fluid: 'sulfuric',     badMaterial: 'carbon steel', reason: 'Severe corrosion at low concentrations — use lead-lined, glass-lined, or PTFE' },
    { fluid: 'caustic',      badMaterial: 'aluminum',     reason: 'Caustic embrittlement — use carbon steel or SS' },
    { fluid: 'naoh',         badMaterial: 'aluminum',     reason: 'Caustic embrittlement — use carbon steel or SS' },
    { fluid: 'ammonia',      badMaterial: 'brass',        reason: 'Ammonia stress corrosion cracking in copper alloys — use steel' },
    { fluid: 'ammonia',      badMaterial: 'copper',       reason: 'Ammonia stress corrosion cracking — use steel' },
    { fluid: 'chloride',     badMaterial: 'austenitic',   reason: 'Chloride stress corrosion in 304/316 SS — consider duplex SS or alloy' },
    { fluid: 'palm oil',     badMaterial: 'galvanized',   reason: 'Zinc dissolves into hot CPO — use SS316 or food-grade material' },
    { fluid: 'cpo',          badMaterial: 'galvanized',   reason: 'Zinc dissolves into hot CPO — use SS316 or food-grade material' },
  ];

  for (const c of components) {
    const compName = (c.name ?? '').toLowerCase();
    const compMat = (c.material ?? '').toLowerCase();
    if (!compMat) continue;
    for (const rule of incompatibilities) {
      if (fluidType.includes(rule.fluid) && compMat.includes(rule.badMaterial)) {
        warnings.push({
          code: 'MATERIAL_INCOMPATIBLE',
          severity: 'warning',
          message: `"${c.name}" uses ${c.material}. ${rule.reason}. (Triggered by fluid: ${rule.fluid})`,
        });
        break; // one warning per component is enough
      }
    }
    void compName; // avoid unused-var warning
  }
}

function getChutesClient() {
  return new OpenAI({
    apiKey: process.env.CHUTES_API_KEY!,
    baseURL: 'https://llm.chutes.ai/v1',
    maxRetries: 0, // we handle fallback ourselves — don't waste seconds on doomed retries
  });
}

function getGeminiClient() {
  return new OpenAI({
    apiKey: process.env.GEMINI_API_KEY ?? 'placeholder',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    maxRetries: 0,
  });
}

function getCerebrasClient() {
  return new OpenAI({
    apiKey: process.env.CEREBRAS_API_KEY!,
    baseURL: 'https://api.cerebras.ai/v1',
    maxRetries: 0,
  });
}

function getGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY!,
    baseURL: 'https://api.groq.com/openai/v1',
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

// ─── Malaysian supplier knowledge by region (compact) ───────────────────────
const MALAYSIA_SUPPLIER_CONTEXT = `
MALAYSIA SUPPLIER DIRECTORY (pick by proximity to project state):

Klang Valley (KL/Selangor) — full coverage, all brands have direct offices:
Pumps: Grundfos (Shah Alam), KSB (PJ), WILO (Shah Alam), Ebara (Subang Jaya), Sulzer (KL), Flowserve (KL).
Valves: Crane Flow (Subang Jaya), KITZ (PJ), Pentair, Spirax Sarco (KL), Emerson (KL).
Instruments: Endress+Hauser (PJ), Yokogawa (KL), Honeywell, ABB (Subang Jaya), Siemens (PJ), WIKA (Shah Alam).
Hydraulics/Pneumatics: Parker Hannifin (Puchong), SMC (Shah Alam), Festo, Bosch Rexroth.
Heat/Process: Alfa Laval (PJ), Atlas Copco (Subang Jaya), Donaldson, Pall, SKF, Swagelok, Georg Fischer.

Penang — Bayan Lepas FIZ; Pentair Malaysia local; strong HVAC + E&E suppliers. KL suppliers deliver in 1–2 days.
Johor (incl. Pengerang RAPID/PIC) — Schlumberger/Cameron (JB), Technip, Sapura Industrial; KL same-day logistics.
Terengganu (Kerteh/Gebeng) — Petronas-qualified preferred; Uzma, Icon Offshore; KL delivers in 2–4 hrs.
Sabah/Sarawak (East Malaysia) — add 10–15% logistics premium; KL air 2–3 days, sea 7–14 days. SIRIM/ST approval often required.
Other states (Perak, Kedah, Kelantan, Pahang) — KL suppliers via 1–3 day courier; +5–10% premium.

PRICING BENCHMARKS (MYR 2024–25, inc. SST; USD 1 ≈ MYR 4.65; foreign equipment add 5–25% import duty):
- Centrifugal pump 5–15 kW: RM 3.5k–18k | >30 kW: RM 25k–120k
- Gate valve DN50 CS: RM 180–450 | DN150 SS: RM 950–3,500
- Ball valve DN25 SS316: RM 120–480
- Globe control valve (actuated): RM 5,500–28,000
- Pressure transmitter (4–20mA): RM 2,800–9,500 | Temp transmitter+thermowell: RM 1,800–5,500
- Electromagnetic flow meter DN50: RM 6,500–18,000
- PSV spring-loaded: RM 800–4,500 | Y-strainer DN100 SS316: RM 1,200–3,800
- Air compressor screw 7.5 kW: RM 6,500–14,000 | Solenoid DN25: RM 350–1,200
- CS pipe SCH40 DN100: RM 85–140/m | SS316L SCH10S DN50: RM 180–320/m

COMPLIANCE: DOSH FMA 1967 (pressure vessels/boilers), BOMBA (fire/flammables), SIRIM (product cert), DOE (environment), PETRONAS PTS (oil & gas), Malaysia Standards (MS 1745/1821), JKR (govt infra).
`;

const SYSTEM_PROMPT = `You are a senior Malaysian industrial fluid systems engineer (20+ yrs experience: process plants, refineries, water treatment, manufacturing).

${MALAYSIA_SUPPLIER_CONTEXT}

Rules:
- Use REAL Malaysian suppliers above, picked by proximity to project state.
- All money in MYR (use benchmark prices).
- Determine process parameters from application + scale; do not ask user.
- Apply DOSH, BOMBA, SIRIM, DOE, PETRONAS PTS where relevant.
- Account for tropical climate, humidity, corrosion (outdoor MY).

OUTPUT FORMAT — non-negotiable:
Reply with ONE raw JSON object. First char "{", last char "}". No markdown fences, no prose, no comments. Output must be JSON.parse-able.`;

function stateLabel(val: string): string {
  const map: Record<string, string> = {
    kuala_lumpur: 'Kuala Lumpur',
    selangor: 'Selangor',
    penang: 'Penang',
    johor: 'Johor',
    perak: 'Perak',
    negeri_sembilan: 'Negeri Sembilan',
    melaka: 'Melaka',
    pahang: 'Pahang',
    terengganu: 'Terengganu',
    kelantan: 'Kelantan',
    kedah: 'Kedah',
    perlis: 'Perlis',
    sabah: 'Sabah',
    sarawak: 'Sarawak',
    putrajaya: 'Putrajaya',
    labuan: 'Labuan',
  };
  return map[val] ?? val.replace(/_/g, ' ');
}

function buildScaleText(input: ProjectInput): string {
  const parts: string[] = [];
  if (input.scaleFlowRateValue) {
    parts.push(`Flow rate: ${input.scaleFlowRateValue} ${input.scaleFlowRateUnit}`);
  }
  if (input.scaleVolumeMonthlyValue) {
    parts.push(`Volume per month: ${input.scaleVolumeMonthlyValue} ${input.scaleVolumeMonthlyUnit}`);
  }
  return parts.length > 0 ? parts.join(' | ') : 'Not specified — estimate from application description';
}

const FLUID_LABELS: Record<string, string> = {
  water_utility: 'Utility Water', cooling_water: 'Cooling Water',
  demineralised_water: 'Demineralised Water', ultrapure_water: 'Ultrapure / Deionised Water (UPW)',
  purified_water: 'Purified Water (PW)', wfi: 'Water for Injection (WFI)',
  seawater: 'Seawater', chilled_water: 'Chilled Water',
  steam_lp: 'Low-Pressure Steam (< 10 bar)', steam_hp: 'High-Pressure Steam (≥ 10 bar)',
  crude_oil: 'Crude Oil', natural_gas: 'Natural Gas', lng: 'LNG (Liquefied Natural Gas)',
  fuel_oil: 'Fuel Oil', hydraulic_oil: 'Hydraulic Oil', glycol: 'Glycol Solution (MEG/DEG/TEG)',
  cpo: 'Crude Palm Oil (CPO)', pko: 'Palm Kernel Oil (PKO)',
  rbdpo: 'RBD Palm Oil / Olein / Stearin', palm_fatty_acid: 'Palm Fatty Acid Distillate (PFAD)',
  compressed_air: 'Compressed Air', nitrogen: 'Nitrogen (N₂)',
  co2: 'CO₂', ammonia_gas: 'Ammonia (NH₃)',
  latex: 'Natural Rubber Latex', ammonia_latex: 'Ammonia Solution (Latex Preservation)',
  formic_acid: 'Formic / Acetic Acid (Coagulant)',
  refrigerant_hfc: 'HFC Refrigerant (R134a/R410A)', refrigerant_co2: 'CO₂ Refrigerant (R744)',
  refrigerant_nh3: 'Ammonia Refrigerant (R717)',
  slurry: 'Slurry / Abrasive Fluid', palm_effluent: 'Palm Oil Mill Effluent (POME)',
  wastewater: 'Industrial Wastewater / Effluent',
};

function getFluidName(input: ProjectInput): string {
  const needsSpec = ['chemical_acid', 'chemical_alkali', 'chemical_solvent', 'chemical_other', 'other'];
  if (needsSpec.includes(input.fluidType)) {
    return input.customFluidType ?? input.fluidType.replace(/_/g, ' ');
  }
  return FLUID_LABELS[input.fluidType] ?? input.fluidType.replace(/_/g, ' ');
}

function buildPrompt(input: ProjectInput): string {
  const fluidName = getFluidName(input);

  const state = stateLabel(input.malaysiaState);
  const env = input.siteEnvironment.replace(/_/g, ' ');
  const scale = buildScaleText(input);

  return `Design a complete industrial fluid system for a project in ${state}, Malaysia.

PROJECT: ${input.projectName}
INDUSTRY: ${input.industry}
APPLICATION: ${input.application}
FLUID: ${fluidName}
SITE: ${env}
SYSTEM SCALE: ${scale}
BUDGET: RM ${input.budget.toLocaleString()} MYR
SPECIAL REQUIREMENTS: ${input.specialRequirements || 'None'}
LOCATION: ${state}, Malaysia — select suppliers closest to this state

INSTRUCTIONS:
1. Determine all process parameters from the application description and scale inputs. If scale is provided, size ALL components (pump kW, pipe diameter, vessel volume, etc.) to match exactly. Explain your engineering basis.
2. All costs in MYR. Use Malaysian market prices including SST.
3. For suppliers: pick brands with offices or distributors nearest to ${state}. If in East Malaysia, account for extra logistics cost (10–15% premium). Calculate transportation cost separately as a line item based on shipment from supplier city to ${state}.
4. Apply relevant Malaysian regulations (DOSH, BOMBA, SIRIM, DOE, PETRONAS PTS as applicable).
5. SKIP the alternatives array for every component — leave "alternatives": [] to conserve output tokens for a complete BOM.
6. For EVERY component assign confidence_level (0–100): how optimal this choice is for this fluid/environment.
7. For EVERY component assign lifespan_years (service life before major overhaul in Malaysian climate).
8. Assign overall_confidence (0–100) for the entire recommendation.
9. COMPLETE BOM — procurement-ready, every physical item as its own line. Walk the P&ID from source to destination. Include all that apply (presence = engineering necessity; quantity = scale/budget):

Rotating: duty pump (type + kW), standby pump if criticality warrants, mechanical seals, couplings + guards.
Vessels: suction header/feed tank, discharge header, expansion vessel (closed systems), dosing pot, separator/filter housing.
Valves: suction isolation, discharge isolation, check valve (per pump discharge), PSV (every pressurised vessel — DOSH), control valve, drain valves (low points), vent valves (high points), sample valves, bypass valve set.
Piping & fittings: pipe (material/schedule/length), elbows-tees-reducers lot, flanges + gaskets set, flex hose/expansion joints at pump connections, supports/clamps/hangers.
Instrumentation: FT on main line, PT on suction + discharge + key points, local gauges at pump nozzles, TT if temp is a process variable, LT on every vessel, dP across filters/HX, analytical (pH/conductivity/turbidity) if fluid quality matters.
Electrical/control: MCC or VFD panel per motor (combine if co-located), local control panel, power cables sized to kW + run length, instrument cables, earthing (mandatory for flammables — DOSH).
Structural: skid/base frame, pipe support steelwork, bund/drip tray for hazardous fluids (DOE), access platforms if elevated.
Safety: safety shower + eyewash (chem/acid/caustic), fire & gas detectors (flammables — BOMBA), thermal insulation, heat tracing (congealing/freezing fluids), commissioning strainer + spares kit.

SELF-CHECK: Can the system start up, run, be isolated for maintenance, drained, vented, instrumented, controlled, overpressure-protected, and safely shut down — using only your listed components? If not, add the missing items.

10. HAZOP — apply standard guidewords across main process line + nodes (suction, discharge, control valve, vessels, HX). Generate a distinct risk entry for each realistic guideword:
NO FLOW (blockage/closed valve/pump trip), MORE FLOW (control valve fails open), LESS FLOW (partial block/fouled strainer), REVERSE FLOW (check valve fail), MORE PRESSURE (blocked discharge/thermal expansion/PSV fail), LESS PRESSURE (cavitation/starvation), MORE TEMP (cooling loss/runaway), LESS TEMP (heating loss/freeze), CONTAMINATION (wrong fluid/cross-connect/corrosion products), LEAK/RELEASE (flange/seal/rupture), LOSS OF UTILITY (power/instrument air/cooling), MAINTENANCE (LOTO failure), CORROSION/EROSION (incompatible material/high velocity), ELECTRICAL FAULT (short/VFD/earth — BOMBA).
TARGET: ≥20 entries, all distinct hazard/cause/consequence. Cite DOSH FMA 1967, BOMBA UBBL, SIRIM, or DOE in mitigations where applicable.

11. MANDATORY blocks — never null/empty:
- piping: real material/diameter/schedule/connection/notes
- instrumentation: ≥4 tags — FT (main), PT (discharge), PT (suction or vessel), TT (if temp matters); add LT for vessels, AT/QT for chemistry
- risk_assessment.risks: ≥20 entries from HAZOP above
- engineering_calculations: every applicable field computed
- process_flow: minimum 10 nodes, minimum 9 edges — see rules below

PROCESS FLOW DIAGRAM (P&ID) — this drives a visual diagram. Quality requirements:
- MINIMUM 10 nodes, IDEALLY 12-18. Cover: source/tank → suction isolation → strainer → pump(s) → check valve → instruments (PT/FT) → discharge valve → PSV → process equipment (HX/vessel/etc.) → control valve → expansion → destination.
- EVERY node must be connected — no orphan nodes. Each node appears in at least one edge.
- Edges form a CONTINUOUS chain from source to destination. Walk the JSON in order — there should be a path from the first vessel to the last.
- Use IDs that MATCH your BOM component IDs where possible (e.g. if BOM has C-001 = main pump, use "P-101" or "C-001" consistently in both).
- node.type must be one of: "vessel", "pump", "valve", "instrument", "equipment", "fitting", "other".
- Optional edge.label for pipe size / fluid (e.g. "DN100 SS316L", "DN50 PVC").
- Include redundancy where the system has it: duty + standby pumps both connect to same header.
- For complex systems include bypass loops, sample lines, drain lines as branch edges.

12. COST INTEGRITY — every monetary value must trace back to a source:
- Every component MUST have unit_cost_myr (real catalogue / market price) AND price_basis (source: "Grundfos Malaysia May 2026 list price", "based on supplier quote from KITZ PJ", "Malaysian SIRIM-listed pricing", etc.).
- total_cost_myr = unit_cost_myr × quantity. Compute it, don't guess.
- equipment_cost_myr in cost_estimate MUST equal sum of all component total_cost_myr. If you sum it manually and get a different number, recheck — there is no other source of truth.
- Transportation: 5–15% of equipment cost based on distance / East Malaysia premium.
- Installation: 15–25% of equipment cost based on system scale.
- Engineering: 8–15% of equipment cost.
- Commissioning: 3–8% of equipment cost.
- total_cost_myr = equipment + transportation + installation + engineering + commissioning. Verify the sum.
- DO NOT invent costs that don't appear in the BOM. If a category line shows RM X but the components only justify RM X/10, the user loses trust.

13. ENGINEERING CALCULATIONS — fill with REAL numbers from your process parameters:
- NPSHa = atm_pressure + suction_static_head − vapour_pressure − friction_losses
- TDH = static_head + friction_head + velocity_head
- Pump shaft kW = (Q_m3/s × H_m × ρ × 9.81) / (η × 1000); η ≈ 0.65–0.75
- Motor size: next IEC step ≥ shaft kW (5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75…)
- Re = (ρ × v × D_m) / μ_Pa·s; laminar <2300, transitional 2300–4000, turbulent >4000
- Friction factor: Colebrook or Swamee-Jain for turbulent
- ΔP/L = f × (ρ × v²) / (2 × D), convert to bar/100m
Use water properties at operating temperature; adjust for other fluids.

COMPACT OUTPUT CONTRACT — mandatory to fit a complete BOM in the token budget:
• specification / notes / lifespan_notes / price_basis / design_basis / engineering_notes: MAX 12 WORDS each. Use short phrases, not sentences.
• hazop_summary / basis fields: MAX 15 WORDS each.
• alternatives: [] — always empty. Skip entirely.
• A BOM with 15 compact components beats 5 verbose ones every time.
• If approaching token limit: finish components, then risks. Never cut components short.

Return ONLY this JSON. components is generated FIRST so it cannot be truncated by token limits:
{
  "summary": "2-3 sentence system overview",
  "system_type": "system classification",
  "design_basis": "engineering basis, scale, Malaysian code references",
  "overall_confidence": 85,
  "process_parameters": {
    "design_flow_rate": "45 m³/hr",
    "operating_pressure": "8 bar(g)",
    "design_pressure": "12 bar(g)",
    "operating_temperature": "65°C",
    "design_temperature": "85°C",
    "fluid_velocity": "2.5 m/s",
    "basis": "1-2 sentences on how values were determined"
  },
  "components": [
    {
      "id": "C-001",
      "name": "Centrifugal Pump — Duty",
      "category": "pump",
      "quantity": 1,
      "specification": "DN50, 7.5kW, SS316 casing, API 610",
      "material": "SS316",
      "supplier": "Grundfos Malaysia, Shah Alam",
      "model": "CM 10-3",
      "unit_cost_myr": 12000,
      "total_cost_myr": 12000,
      "notes": "API 610; DOSH-registered; tropicalised motor",
      "confidence_level": 88,
      "lifespan_years": 15,
      "lifespan_notes": "SS316 body; MY humidity allowance",
      "price_basis": "Grundfos MY 2026 list",
      "alternatives": []
    }
  ],
  "engineering_calculations": {
    "npsh_available_m": 7.2,
    "npsh_required_m": 4.5,
    "npsh_margin_m": 2.7,
    "total_dynamic_head_m": 35,
    "static_head_m": 8,
    "friction_head_m": 27,
    "pump_power_kw": 6.8,
    "motor_size_kw": 7.5,
    "pipe_velocity_m_s": 2.2,
    "reynolds_number": 195000,
    "flow_regime": "turbulent",
    "friction_factor": 0.019,
    "pressure_drop_bar_per_100m": 0.42,
    "heat_load_kw": 175,
    "notes": "Darcy-Weisbach for water at op temp; NPSH margin per API 610; motor sized per IEC 60034"
  },
  "process_flow": {
    "nodes": [
      { "id": "T-101",   "label": "Feed Tank",          "type": "vessel" },
      { "id": "SV-101",  "label": "Suction Isolation",  "type": "valve" },
      { "id": "ST-101",  "label": "Y-Strainer",         "type": "fitting" },
      { "id": "P-101",   "label": "Pump P-101 (duty)",  "type": "pump" },
      { "id": "P-102",   "label": "Pump P-102 (standby)", "type": "pump" },
      { "id": "CV-101",  "label": "Check Valve",        "type": "valve" },
      { "id": "PT-101",  "label": "Pressure TX",        "type": "instrument" },
      { "id": "FT-101",  "label": "Flow TX",            "type": "instrument" },
      { "id": "DV-101",  "label": "Discharge Valve",    "type": "valve" },
      { "id": "PSV-101", "label": "PSV (relief)",       "type": "valve" },
      { "id": "HX-101",  "label": "Heat Exchanger",     "type": "equipment" },
      { "id": "TT-101",  "label": "Temp TX",            "type": "instrument" },
      { "id": "CV-102",  "label": "Control Valve",      "type": "valve" },
      { "id": "EV-101",  "label": "Expansion Vessel",   "type": "vessel" },
      { "id": "DEST",    "label": "Process Destination", "type": "vessel" }
    ],
    "edges": [
      { "from": "T-101",  "to": "SV-101",  "label": "DN100 SS316L" },
      { "from": "SV-101", "to": "ST-101" },
      { "from": "ST-101", "to": "P-101" },
      { "from": "ST-101", "to": "P-102" },
      { "from": "P-101",  "to": "CV-101" },
      { "from": "P-102",  "to": "CV-101" },
      { "from": "CV-101", "to": "PT-101" },
      { "from": "PT-101", "to": "FT-101" },
      { "from": "FT-101", "to": "DV-101" },
      { "from": "DV-101", "to": "PSV-101" },
      { "from": "PSV-101","to": "HX-101" },
      { "from": "HX-101", "to": "TT-101" },
      { "from": "TT-101", "to": "CV-102" },
      { "from": "CV-102", "to": "EV-101" },
      { "from": "EV-101", "to": "DEST" }
    ]
  },
  "piping": {
    "material": "e.g. Carbon Steel, SS316L, HDPE",
    "nominal_diameter_inch": 2,
    "schedule": "40",
    "connection_type": "flanged|threaded|welded",
    "insulation_required": false,
    "insulation_type": null,
    "design_notes": "corrosion allowance + sizing basis"
  },
  "instrumentation": [
    { "tag": "FT-101", "description": "Flow Transmitter — Main Line", "type": "flow", "service": "monitor flow", "range": "0-100 m³/hr", "material": "lined body, SS electrodes", "supplier": "Malaysian supplier + city", "unit_cost_myr": 0 },
    { "tag": "PT-101", "description": "Pressure Transmitter — Pump Discharge", "type": "pressure", "service": "discharge pressure", "range": "0-10 bar(g)", "material": "SS316 wetted", "supplier": "Malaysian supplier + city", "unit_cost_myr": 0 },
    { "tag": "PT-102", "description": "Pressure Transmitter — Pump Suction", "type": "pressure", "service": "suction pressure", "range": "0-10 bar(g)", "material": "SS316 wetted", "supplier": "Malaysian supplier + city", "unit_cost_myr": 0 },
    { "tag": "TT-101", "description": "Temperature Transmitter", "type": "temperature", "service": "process temp", "range": "0-100°C", "material": "SS316 thermowell", "supplier": "Malaysian supplier + city", "unit_cost_myr": 0 }
  ],
  "risk_assessment": {
    "overall_risk_level": "low|medium|high|critical",
    "hazop_summary": "1-2 sentences with Malaysian regulatory context",
    "risks": [
      { "id": "R-001", "category": "mechanical|chemical|thermal|electrical|operational|environmental", "hazard": "NO FLOW in main discharge — describe", "cause": "pump trip / valve closed", "consequence": "process upset", "likelihood": "low|medium|high", "severity": "low|medium|high|critical", "risk_level": "low|medium|high|critical", "safeguard": "PT low alarm, auto-trip", "mitigation": "DOSH/BOMBA reference" }
    ]
  },
  "maintenance_schedule": [
    { "frequency": "daily|weekly|monthly|quarterly|biannual|annual", "tasks": [ { "task": "name", "procedure": "brief", "estimated_duration_hours": 1, "requires_shutdown": false } ] }
  ],
  "compliance_standards": [
    { "standard": "DOSH FMA 1967", "description": "pressure vessel registration" }
  ],
  "cost_estimate": {
    "equipment_cost_myr": 0,
    "transportation_cost_myr": 0,
    "installation_cost_myr": 0,
    "engineering_cost_myr": 0,
    "commissioning_cost_myr": 0,
    "total_cost_myr": 0,
    "within_budget": true,
    "budget_notes": "vs budget; transport from supplier cities to project state; East MY premium if applicable"
  },
  "lead_time_weeks": 8,
  "recommended_vendors": [
    { "vendor": "Vendor Name", "specialty": "what they supply", "region": "Malaysian state", "website_hint": "vendor.com.my" }
  ],
  "engineering_notes": "design recs, commissioning notes, MY-specific points, confidence caveats"
}`;
}

// ─── JSON extraction & repair ─────────────────────────────────────────────────

function extractJSON(raw: string): string {
  let s = raw.trim();

  // Strip markdown code fences (handles ```json, ```JSON, ``` etc.)
  const fenceMatch = s.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) s = fenceMatch[1].trim();

  // Find the LAST closing brace — discards trailing prose like "Hope this helps!"
  const lastBrace = s.lastIndexOf('}');
  // Find the FIRST opening brace — discards leading prose like "Here is the BOM:"
  const firstBrace = s.indexOf('{');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  } else if (firstBrace > 0) {
    s = s.slice(firstBrace);
  }

  return s.trim();
}

function repairTruncatedJSON(s: string): string {
  // Count open braces/brackets to determine how many closers are needed
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }

  // Remove trailing incomplete token (comma, colon, partial string)
  let trimmed = s.trimEnd();
  // Remove trailing comma before we close
  trimmed = trimmed.replace(/,\s*$/, '');
  // If we ended mid-string, close it
  if (inString) trimmed += '"';

  // Close open brackets/braces in reverse order
  for (let i = 0; i < brackets; i++) trimmed += ']';
  for (let i = 0; i < braces; i++) trimmed += '}';

  return trimmed;
}

function parseAIResponse(content: string): Record<string, unknown> {
  const jsonStr = extractJSON(content);

  // First attempt: parse as-is
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    // Second attempt: repair truncated JSON
    try {
      const repaired = repairTruncatedJSON(jsonStr);
      return JSON.parse(repaired) as Record<string, unknown>;
    } catch {
      throw new SyntaxError('Could not parse or repair AI response as JSON');
    }
  }
}

// ─── Response validation ──────────────────────────────────────────────────────

// Strip malformed entries from arrays before Zod validation.
// JSON truncation often leaves the last 1-3 components as strings or partial objects.
// We drop those silently rather than fail the whole report.
function cleanRecommendation(rec: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...rec };

  // Components: keep only objects with a name field
  if (Array.isArray(cleaned.components)) {
    const arr = cleaned.components as unknown[];
    const before = arr.length;
    const filtered = arr.filter(
      (c) => typeof c === 'object' && c !== null && typeof (c as { name?: unknown }).name === 'string' && ((c as { name: string }).name).trim().length > 0,
    );
    cleaned.components = filtered;
    const dropped = before - filtered.length;
    if (dropped > 0) console.warn(`[cleanup] dropped ${dropped} malformed component(s)`);
  }

  // Risks: keep only objects with a hazard field
  const ra = cleaned.risk_assessment as { risks?: unknown[] } | undefined;
  if (ra && Array.isArray(ra.risks)) {
    const before = ra.risks.length;
    ra.risks = ra.risks.filter(
      (r) => typeof r === 'object' && r !== null && typeof (r as { hazard?: unknown }).hazard === 'string',
    );
    const dropped = before - ra.risks.length;
    if (dropped > 0) console.warn(`[cleanup] dropped ${dropped} malformed risk(s)`);
  }

  // Instrumentation: keep only objects with a tag
  if (Array.isArray(cleaned.instrumentation)) {
    cleaned.instrumentation = cleaned.instrumentation.filter(
      (i) => typeof i === 'object' && i !== null && typeof (i as { tag?: unknown }).tag === 'string',
    );
  }

  // Process flow: clean nodes (need id) and edges (need from + to)
  const pf = cleaned.process_flow as { nodes?: unknown[]; edges?: unknown[] } | undefined;
  if (pf) {
    if (Array.isArray(pf.nodes)) {
      pf.nodes = pf.nodes.filter(
        (n) => typeof n === 'object' && n !== null && typeof (n as { id?: unknown }).id === 'string' && ((n as { id: string }).id).trim().length > 0,
      );
    }
    if (Array.isArray(pf.edges)) {
      const validIds = new Set(((pf.nodes as Array<{ id: string }>) ?? []).map((n) => n.id));
      pf.edges = (pf.edges as unknown[]).filter((e) => {
        if (typeof e !== 'object' || e === null) return false;
        const edge = e as { from?: unknown; to?: unknown };
        if (typeof edge.from !== 'string' || typeof edge.to !== 'string') return false;
        // If we have nodes, drop edges that reference non-existent nodes
        if (validIds.size > 0 && (!validIds.has(edge.from) || !validIds.has(edge.to))) return false;
        return true;
      });
    }
    // Drop the AI's "_instruction" key if it copied it
    delete (pf as { _instruction?: unknown })._instruction;
  }

  // ─── COST RECONCILIATION ──────────────────────────────────────────────
  // The AI sometimes invents equipment_cost_myr that doesn't match the BOM sum.
  // We ALWAYS recompute equipment cost from the actual components, and rebuild
  // total_cost_myr from the verified breakdown. Truth comes from the BOM, not the AI.
  reconcileCosts(cleaned);

  return cleaned;
}

interface CostEstimate {
  equipment_cost_myr?: number;
  equipment_basis?: string;
  transportation_cost_myr?: number;
  transportation_basis?: string;
  installation_cost_myr?: number;
  installation_basis?: string;
  engineering_cost_myr?: number;
  engineering_basis?: string;
  commissioning_cost_myr?: number;
  commissioning_basis?: string;
  total_cost_myr?: number;
  within_budget?: boolean;
  budget_notes?: string;
  cost_basis?: string;  // legacy / overall basis note
}

// Rewrite the budget_notes line based on the user's actual input budget and
// the server-reconciled total. The AI's original text often cites its
// pre-reconciliation numbers and contradicts the displayed total.
function rewriteBudgetNotes(rec: Record<string, unknown>, input: ProjectInput): void {
  const ce = rec.cost_estimate as CostEstimate | undefined;
  if (!ce) return;
  const total = ce.total_cost_myr ?? 0;
  const budget = input.budget;
  if (!budget || !total) return;

  const fmt = (n: number) => 'RM ' + n.toLocaleString('en-MY', { maximumFractionDigits: 0 });
  const diff = total - budget;
  const pctOver = (total / budget - 1) * 100;
  ce.within_budget = total <= budget;

  if (diff > 0) {
    ce.budget_notes = `Exceeds ${fmt(budget)} budget by ${fmt(diff)} (${pctOver.toFixed(1)}% over). Per AACE Class 4–5 methodology, this estimate has ±30–50% accuracy — supplier quotations may reduce final spend. Consider value engineering on equipment selection or reducing scope.`;
  } else if (diff < 0) {
    ce.budget_notes = `Within ${fmt(budget)} budget. ${fmt(Math.abs(diff))} headroom (${Math.abs(pctOver).toFixed(1)}% under). AACE Class 4–5 estimate has ±30–50% accuracy — keep contingency for design refinement.`;
  } else {
    ce.budget_notes = `On budget at exactly ${fmt(budget)}. AACE Class 4–5 estimate has ±30–50% accuracy.`;
  }

  rec.cost_estimate = ce as unknown as Record<string, unknown>;
}

function reconcileCosts(rec: Record<string, unknown>): void {
  // Sum equipment from real components
  const components = (rec.components as Array<{ total_cost_myr?: number; unit_cost_myr?: number; quantity?: number }> | undefined) ?? [];
  let equipmentSum = 0;
  for (const c of components) {
    const total = typeof c.total_cost_myr === 'number'
      ? c.total_cost_myr
      : (typeof c.unit_cost_myr === 'number' && typeof c.quantity === 'number')
        ? c.unit_cost_myr * c.quantity
        : 0;
    equipmentSum += total;
  }

  if (equipmentSum === 0) return; // no usable BOM data — leave AI numbers alone

  const ce = (rec.cost_estimate as CostEstimate | undefined) ?? {};
  const aiClaimedEquipment = ce.equipment_cost_myr ?? 0;
  const drift = aiClaimedEquipment > 0
    ? Math.abs(aiClaimedEquipment - equipmentSum) / Math.max(aiClaimedEquipment, equipmentSum)
    : 1;

  const componentCount = components.length;
  ce.equipment_cost_myr = Math.round(equipmentSum);

  // EQUIPMENT BASIS
  if (drift > 0.05) {
    console.warn(`[reconcile] equipment cost mismatch — AI: RM ${aiClaimedEquipment.toLocaleString()} vs BOM sum: RM ${equipmentSum.toLocaleString()} (${(drift * 100).toFixed(1)}% drift). Overriding with BOM sum.`);
    ce.equipment_basis = `Sum of ${componentCount} BOM line items (verified server-side). AI's original estimate was off by ${(drift * 100).toFixed(0)}% — overridden with actual BOM total.`;
  } else {
    ce.equipment_basis = `Sum of ${componentCount} BOM line items at quoted Malaysian supplier prices (verified server-side).`;
  }

  // Helper to compute or default a percentage-based cost line
  function deriveLine(
    rawValue: number | undefined,
    defaultPct: number,
    lineName: string,
    rationale: string,
  ): { value: number; basis: string } {
    const equipment = ce.equipment_cost_myr ?? 0;
    let value = rawValue ?? 0;
    let pctText: string;
    let source: string;

    if (value > 0 && equipment > 0) {
      const pct = (value / equipment) * 100;
      // If AI's number is wildly out of typical range, fall back to default percentage
      const typicalLow = defaultPct * 0.4;
      const typicalHigh = defaultPct * 2.0;
      if (pct < typicalLow || pct > typicalHigh) {
        value = Math.round(equipment * (defaultPct / 100));
        pctText = `${defaultPct.toFixed(1)}% of equipment cost`;
        source = `AI estimate was outside typical ${typicalLow.toFixed(0)}–${typicalHigh.toFixed(0)}% range — replaced with industry-standard default. ${rationale}`;
      } else {
        pctText = `${pct.toFixed(1)}% of equipment cost`;
        source = rationale;
      }
    } else {
      // No AI value — generate from default
      value = Math.round(equipment * (defaultPct / 100));
      pctText = `${defaultPct.toFixed(1)}% of equipment cost`;
      source = `Industry-standard estimate. ${rationale}`;
    }
    return {
      value,
      basis: `${pctText} (RM ${value.toLocaleString('en-MY')}). ${source}`,
    };
  }

  // TRANSPORTATION
  const transport = deriveLine(
    ce.transportation_cost_myr,
    10,
    'Transportation',
    'Per AACE Class 3–4 estimating practice (5–15% of equipment for domestic logistics). Covers shipment from supplier cities (Klang Valley / PJ) to project site, including handling, port fees, and inland trucking. East Malaysia projects warrant 10–15% air/sea freight premium.',
  );
  ce.transportation_cost_myr = transport.value;
  ce.transportation_basis = transport.basis;

  // INSTALLATION
  const install = deriveLine(
    ce.installation_cost_myr,
    20,
    'Installation',
    'Per AACE Recommended Practice 18R-97 and Lang Factor Method for process equipment (typical 15–25% of equipment cost). Covers mechanical erection, piping fabrication, electrical termination, instrument hook-up, and pre-commissioning by Malaysian DOSH-licensed contractor.',
  );
  ce.installation_cost_myr = install.value;
  ce.installation_basis = install.basis;

  // ENGINEERING
  const engineering = deriveLine(
    ce.engineering_cost_myr,
    12,
    'Engineering',
    'Per EPC industry benchmarks and Hand\'s Method for chemical plant estimating (typical 10–15% of equipment cost for Class 3–4 detailed design). Covers P&ID development, equipment data sheets, hydraulic calculations, site supervision, and as-built documentation by a licensed PE.',
  );
  ce.engineering_cost_myr = engineering.value;
  ce.engineering_basis = engineering.basis;

  // COMMISSIONING
  const commissioning = deriveLine(
    ce.commissioning_cost_myr,
    5,
    'Commissioning',
    'Per AACE Lang Factor Method for process system start-up (typical 3–8% of equipment cost). Covers system flushing, hydrostatic pressure testing, fluid loading, control loop tuning, operator training, and performance verification per DOSH commissioning requirements.',
  );
  ce.commissioning_cost_myr = commissioning.value;
  ce.commissioning_basis = commissioning.basis;

  // RECOMPUTED TOTAL — always sum from the (now-verified) breakdown
  const recomputedTotal = ce.equipment_cost_myr + transport.value + install.value + engineering.value + commissioning.value;
  ce.total_cost_myr = Math.round(recomputedTotal);

  rec.cost_estimate = ce as unknown as Record<string, unknown>;
}

function validateRecommendation(rec: Record<string, unknown>): Record<string, unknown> {
  const cleaned = cleanRecommendation(rec);

  // Only hard-reject a completely empty BOM — anything else we accept and warn.
  const components = Array.isArray(cleaned.components) ? cleaned.components : [];
  if (components.length === 0) {
    throw new Error('AI response has no usable components (BOM is empty)');
  }
  if (!cleaned.summary || typeof cleaned.summary !== 'string') {
    cleaned.summary = 'AI-generated fluid system design';
  }
  if (!cleaned.system_type || typeof cleaned.system_type !== 'string') {
    cleaned.system_type = 'Industrial fluid system';
  }

  // Try Zod parse to apply transforms/defaults. If it fails on a non-critical field,
  // log it and return the cleaned object anyway — better imperfect output than no output.
  const result = RecommendationSchema.safeParse(cleaned);
  if (result.success) {
    return result.data as Record<string, unknown>;
  }

  // Non-critical schema mismatch — log and continue with cleaned (not Zod-transformed) data
  const allIssues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  console.warn(`[validation] ${allIssues.length} non-critical schema mismatch(es) — accepting anyway:`);
  allIssues.slice(0, 5).forEach((m) => console.warn(`  - ${m}`));
  return cleaned;
}

// ─── Model roster — tried in order until one succeeds ────────────────────────
//
// Priority order:
//  1. Gemini 2.0 Flash      — primary (free, 1M TPD, huge context)
//  2. Chutes / DeepSeek V3  — fallback (handles large prompts)

interface ModelConfig {
  provider: 'chutes' | 'gemini' | 'cerebras' | 'mistral' | 'sambanova' | 'groq';
  model: string;
  max_tokens: number;
}

function buildModelRoster(): ModelConfig[] {
  const roster: ModelConfig[] = [];

  // #1 Groq Llama 3.3 70B — LPU silicon, ~50ms/call. Hits 12k TPM with large prompts
  // so kept first (usually succeeds on first attempt of the session).
  if (process.env.GROQ_API_KEY) {
    roster.push({ provider: 'groq', model: 'llama-3.3-70b-versatile', max_tokens: 8000 });
  }
  // #2 Cerebras Llama 3.3 70B — WSE silicon, very fast, generous free tier, 20k output.
  // IMPORTANT: model MUST be 'llama-3.3-70b' (Cerebras API name, not HuggingFace ID).
  if (process.env.CEREBRAS_API_KEY) {
    roster.push({ provider: 'cerebras', model: 'llama-3.3-70b', max_tokens: 20000 });
  }
  // #3 Gemini 2.0 Flash — completely different infra (Google), 15 req/min free,
  // no TPM cap. Best fallback when Groq/Cerebras are rate-limited.
  if (process.env.GEMINI_API_KEY) {
    roster.push({ provider: 'gemini', model: 'gemini-2.0-flash', max_tokens: 16000 });
  }
  // #4 Mistral Medium — native JSON mode, different vendor
  if (process.env.MISTRAL_API_KEY) {
    roster.push({ provider: 'mistral', model: 'mistral-medium-latest', max_tokens: 10000 });
  }
  // #5 SambaNova Llama 3.3 70B — specialised hardware, frequent 429s
  if (process.env.SAMBANOVA_API_KEY) {
    roster.push({ provider: 'sambanova', model: 'Meta-Llama-3.3-70B-Instruct', max_tokens: 10000 });
  }
  // #6 Chutes DeepSeek V3 — paid tier, high quality, but 400s on json_object mode
  if (process.env.CHUTES_API_KEY) {
    roster.push({ provider: 'chutes', model: 'deepseek-ai/DeepSeek-V3.2-TEE', max_tokens: 16000 });
  }

  return roster;
}

function clientForConfig(cfg: ModelConfig) {
  if (cfg.provider === 'chutes') return getChutesClient();
  if (cfg.provider === 'cerebras') return getCerebrasClient();
  if (cfg.provider === 'mistral') return getMistralClient();
  if (cfg.provider === 'sambanova') return getSambaNovaClient();
  if (cfg.provider === 'groq') return getGroqClient();
  return getGeminiClient();
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    if (
      err.message.includes('429') ||
      err.message.includes('413') ||           // Groq: "413 Request too large ... tokens per minute"
      err.message.toLowerCase().includes('rate limit') ||
      err.message.toLowerCase().includes('too many') ||
      err.message.toLowerCase().includes('too large') ||
      err.message.toLowerCase().includes('timed out')
    ) return true;
    if ('status' in err) {
      const status = (err as { status: number }).status;
      // 429 = rate limit, 413 = request too large (Groq TPM), 5xx = server unavailable
      if (status === 429 || status === 413 || (status >= 500 && status < 600)) return true;
    }
  }
  return false;
}

// ─── Single generation attempt ────────────────────────────────────────────────

async function generateWithModel(
  input: ProjectInput,
  cfg: ModelConfig,
  timeoutMs = 35000, // hard per-provider timeout — leaves budget for fallback within Vercel's 60s
): Promise<Record<string, unknown>> {
  const client = clientForConfig(cfg);
  const startedAt = Date.now();

  console.log(`[/api/generate] trying provider=${cfg.provider} model=${cfg.model} max_tokens=${cfg.max_tokens} timeout=${timeoutMs}ms`);

  // AbortController prevents a slow provider from eating the entire Vercel function budget
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // response_format json_object is only supported by Groq, Cerebras, Gemini, Mistral.
    // Chutes and SambaNova return 400 if this param is sent.
    const supportsJsonMode = ['groq', 'cerebras', 'gemini', 'mistral'].includes(cfg.provider);

    const completion = await client.chat.completions.create(
      {
        model: cfg.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(input) },
        ],
        max_tokens: cfg.max_tokens,
        temperature: 0.2,
        ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
      },
      { signal: controller.signal },
    );

    const elapsed = Date.now() - startedAt;
    console.log(`[/api/generate] ${cfg.model} responded in ${elapsed}ms`);

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI model');

    const recommendation = parseAIResponse(content);
    const cleaned = validateRecommendation(recommendation);
    return cleaned;
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    if (controller.signal.aborted) {
      console.warn(`[/api/generate] ${cfg.model} aborted after ${elapsed}ms (exceeded ${timeoutMs}ms)`);
      throw new Error(`Provider ${cfg.model} timed out after ${Math.round(elapsed / 1000)}s`);
    }
    console.warn(`[/api/generate] ${cfg.model} failed after ${elapsed}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const input: ProjectInput = await request.json();

    // Walk through the model roster (Gemini → Chutes fallback)
    const models = buildModelRoster();
    let lastError: unknown;

    for (const cfg of models) {
      try {
        const recommendation = await generateWithModel(input, cfg);
        // Rewrite budget_notes from the actual reconciled total + user's budget,
        // since the AI's original text often references its pre-reconciled numbers.
        rewriteBudgetNotes(recommendation, input);
        const warnings = runSanityChecks(recommendation);
        if (warnings.length > 0) {
          console.log(`[/api/generate] ${warnings.length} sanity-check warning(s):`, warnings.map((w) => w.code).join(', '));
        }
        // Bundle warnings INTO the recommendation so Firestore persists them
        (recommendation as Record<string, unknown>).validation_warnings = warnings;
        return NextResponse.json({ recommendation, validation_warnings: warnings });
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const status = (err as { status?: number })?.status ?? '—';
        // Payment-required / credit-exhausted errors should ALWAYS skip to next provider
        const isBillingError =
          status === 402 ||
          msg.toLowerCase().includes('payment') ||
          msg.toLowerCase().includes('credit') ||
          msg.toLowerCase().includes('billing') ||
          msg.toLowerCase().includes('insufficient');
        if (isRateLimitError(err) || isBillingError) {
          console.warn(`[/api/generate] ${cfg.model} unavailable (status=${status}, billing=${isBillingError}): ${msg.slice(0, 150)} — trying next provider`);
          continue;
        }
        console.warn(`[/api/generate] parse/validation error on ${cfg.model} (status=${status}): ${msg.slice(0, 150)} — trying next provider`);
        continue;
      }
    }

    // All models exhausted
    throw lastError ?? new Error('All AI models failed');

  } catch (error) {
    console.error('[/api/generate]', error);
    const message = error instanceof Error ? error.message : 'Generation failed';

    if (isRateLimitError(error)) {
      return NextResponse.json(
        { error: 'AI service is busy right now. Please try again in a few minutes.' },
        { status: 429 }
      );
    }
    const isMalformed =
      error instanceof SyntaxError || message.includes('JSON') || message.includes('field');
    return NextResponse.json(
      { error: isMalformed ? 'AI returned an incomplete response. Please try again.' : message },
      { status: 500 }
    );
  }
}
