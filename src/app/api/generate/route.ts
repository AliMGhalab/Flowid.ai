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

  // 4. Component cost outliers — flag single items > 50% of total (might be misplaced decimal)
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

  return warnings;
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
5. For EVERY component, provide exactly 2 alternatives from DIFFERENT Malaysian suppliers with realistic MYR costs and confidence levels.
6. For EVERY component assign a confidence_level (0–100) representing how confident you are this is the optimal choice for this specific application, fluid, and environment. Be honest — flag lower confidence when the application is unusual or specs are ambiguous.
7. For EVERY component assign lifespan_years (expected service life before replacement/major overhaul under normal operating conditions in Malaysian climate) and lifespan_notes explaining key factors.
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

12. ENGINEERING CALCULATIONS — fill with REAL numbers from your process parameters:
- NPSHa = atm_pressure + suction_static_head − vapour_pressure − friction_losses
- TDH = static_head + friction_head + velocity_head
- Pump shaft kW = (Q_m3/s × H_m × ρ × 9.81) / (η × 1000); η ≈ 0.65–0.75
- Motor size: next IEC step ≥ shaft kW (5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75…)
- Re = (ρ × v × D_m) / μ_Pa·s; laminar <2300, transitional 2300–4000, turbulent >4000
- Friction factor: Colebrook or Swamee-Jain for turbulent
- ΔP/L = f × (ρ × v²) / (2 × D), convert to bar/100m
Use water properties at operating temperature; adjust for other fluids.

Return ONLY this JSON. CRITICAL TOKEN STRATEGY: the "components" array is LAST — fill it as completely as you can but never skip the sections above it. If you run low on tokens, truncate the BOM, NEVER skip piping/instrumentation/risks/costs/standards. Keep all text fields tight (1-2 sentences max).
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
    "_instruction": "MANDATORY: list the major equipment as nodes and the physical pipe connections as edges. This drives a P&ID diagram. Use 8-18 nodes covering: source/tank, pump(s), key valves (check, control, PSV), instruments (FT/PT/TT), heat exchangers, separators, destination/header. Connect them in physical flow order from source to destination. Use IDs like T-101, P-101, CV-101, FT-101 that match component IDs in your BOM where possible.",
    "nodes": [
      { "id": "T-101", "label": "Feed Tank", "type": "vessel" },
      { "id": "P-101", "label": "Pump P-101 (duty)", "type": "pump" },
      { "id": "CV-101", "label": "Check Valve", "type": "valve" },
      { "id": "FT-101", "label": "Flow Transmitter", "type": "instrument" }
    ],
    "edges": [
      { "from": "T-101", "to": "P-101", "label": "DN100 SS316L" },
      { "from": "P-101", "to": "CV-101" },
      { "from": "CV-101", "to": "FT-101" }
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
  "engineering_notes": "design recs, commissioning notes, MY-specific points, confidence caveats",
  "components": [
    {
      "id": "C-001",
      "name": "descriptive component name",
      "category": "pump|valve|filter|vessel|fitting|electrical|safety|other",
      "quantity": 1,
      "specification": "full technical spec: size, rating, material, performance — sized to match system scale",
      "material": "material of construction and reason",
      "supplier": "real Malaysian supplier name and city",
      "model": "real model/series example",
      "unit_cost_myr": 0,
      "total_cost_myr": 0,
      "notes": "selection rationale, Malaysian compliance note if applicable",
      "confidence_level": 85,
      "lifespan_years": 15,
      "lifespan_notes": "Expected lifespan under normal conditions; factors affecting longevity for this application",
      "price_basis": "e.g. 'Based on Grundfos Malaysia May 2026 list price for Selangor delivery; bulk discount possible above 5 units'",
      "alternatives": [
        {
          "name": "alternative component name",
          "supplier": "alternative Malaysian supplier",
          "model": "alternative model",
          "reason": "why this is a viable alternative (cost saving, faster delivery, local stock, etc.)",
          "unit_cost_myr": 0,
          "total_cost_myr": 0,
          "confidence_level": 78
        },
        {
          "name": "second alternative component name",
          "supplier": "second alternative Malaysian supplier",
          "model": "second alternative model",
          "reason": "why this is a viable alternative",
          "unit_cost_myr": 0,
          "total_cost_myr": 0,
          "confidence_level": 72
        }
      ]
    }
  ]
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

  return cleaned;
}

function validateRecommendation(rec: Record<string, unknown>): Record<string, unknown> {
  const cleaned = cleanRecommendation(rec);

  // HARD requirements only: we must have a name, system_type, and at least 1 component.
  // Everything else: try to validate, but DON'T reject if non-critical fields are off.
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
  provider: 'chutes' | 'gemini' | 'cerebras' | 'mistral' | 'sambanova';
  model: string;
  max_tokens: number;
}

function buildModelRoster(): ModelConfig[] {
  const roster: ModelConfig[] = [];

  // Cerebras Qwen 235B — primary (fast inference; 8s at 12k tokens earlier = plenty of room)
  if (process.env.CEREBRAS_API_KEY) {
    roster.push({ provider: 'cerebras', model: 'qwen-3-235b-a22b-instruct-2507', max_tokens: 20000 });
  }
  // Mistral Medium — fallback (different vendor, native JSON mode)
  if (process.env.MISTRAL_API_KEY) {
    roster.push({ provider: 'mistral', model: 'mistral-medium-latest', max_tokens: 10000 });
  }
  // SambaNova Llama 3.3 70B — third fallback (specialized fast hardware, different vendor)
  if (process.env.SAMBANOVA_API_KEY) {
    roster.push({ provider: 'sambanova', model: 'Meta-Llama-3.3-70B-Instruct', max_tokens: 10000 });
  }

  return roster;
}

function clientForConfig(cfg: ModelConfig) {
  if (cfg.provider === 'chutes') return getChutesClient();
  if (cfg.provider === 'cerebras') return getCerebrasClient();
  if (cfg.provider === 'mistral') return getMistralClient();
  if (cfg.provider === 'sambanova') return getSambaNovaClient();
  return getGeminiClient();
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    if (
      err.message.includes('429') ||
      err.message.toLowerCase().includes('rate limit') ||
      err.message.toLowerCase().includes('too many') ||
      err.message.toLowerCase().includes('timed out')
    ) return true;
    if ('status' in err) {
      const status = (err as { status: number }).status;
      // Treat 429 and 5xx (server-side unavailable) as "skip to next model"
      if (status === 429 || (status >= 500 && status < 600)) return true;
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
    const completion = await client.chat.completions.create(
      {
        model: cfg.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(input) },
        ],
        max_tokens: cfg.max_tokens,
        temperature: 0.2,
        response_format: { type: 'json_object' },
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
        const warnings = runSanityChecks(recommendation);
        if (warnings.length > 0) {
          console.log(`[/api/generate] ${warnings.length} sanity-check warning(s):`, warnings.map((w) => w.code).join(', '));
        }
        return NextResponse.json({ recommendation, validation_warnings: warnings });
      } catch (err) {
        lastError = err;
        if (isRateLimitError(err)) {
          console.warn(`[/api/generate] rate-limited on ${cfg.model}, trying next model`);
          continue; // try next model
        }
        // JSON / validation error — skip to next provider immediately
        // (retrying the same model takes too long and risks Vercel function timeout)
        console.warn(`[/api/generate] parse/validation error on ${cfg.model}, trying next provider`);
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
