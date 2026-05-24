import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import type { ProjectInput } from '@/types';

export const maxDuration = 120;

// ─── Schema validation (Zod — TypeScript's equivalent of Pydantic) ───────────
// Strict schema enforcement on AI output prevents drift, missing fields, and
// hallucinated values from reaching the user. Failed validation triggers retry.

const RiskSchema = z.object({
  id: z.string(),
  category: z.string(),
  hazard: z.string(),
  cause: z.string(),
  consequence: z.string(),
  likelihood: z.enum(['low', 'medium', 'high']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  safeguard: z.string(),
  mitigation: z.string(),
});

const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  quantity: z.number().nonnegative(),
  specification: z.string(),
  material: z.string(),
  supplier: z.string(),
  model: z.string(),
  unit_cost_myr: z.number().nonnegative().optional(),
  total_cost_myr: z.number().nonnegative().optional(),
  notes: z.string().optional().default(''),
  confidence_level: z.number().min(0).max(100).optional(),
  lifespan_years: z.number().positive().optional(),
  lifespan_notes: z.string().optional(),
  price_basis: z.string().optional(),
  alternatives: z.array(z.any()).optional(),
});

const CostEstimateSchema = z.object({
  equipment_cost_myr: z.number().nonnegative().optional(),
  installation_cost_myr: z.number().nonnegative().optional(),
  engineering_cost_myr: z.number().nonnegative().optional(),
  commissioning_cost_myr: z.number().nonnegative().optional(),
  transportation_cost_myr: z.number().nonnegative().optional(),
  total_cost_myr: z.number().nonnegative().optional(),
  within_budget: z.boolean(),
  budget_notes: z.string().optional().default(''),
}).passthrough();

const RecommendationSchema = z.object({
  summary: z.string().min(10),
  system_type: z.string().min(3),
  design_basis: z.string().optional().default(''),
  components: z.array(ComponentSchema).min(1, 'BOM must contain at least one component'),
  cost_estimate: CostEstimateSchema,
  risk_assessment: z.object({
    overall_risk_level: z.enum(['low', 'medium', 'high', 'critical']),
    hazop_summary: z.string().optional().default(''),
    risks: z.array(RiskSchema),
  }).optional(),
}).passthrough(); // allow extra fields without failing

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

// ─── Malaysian supplier knowledge by region ───────────────────────────────────
const MALAYSIA_SUPPLIER_CONTEXT = `
MALAYSIA INDUSTRIAL SUPPLIER DIRECTORY (select by proximity to project state):

KLANG VALLEY (KL / Selangor) — full supplier coverage, all brands have direct offices:
- Grundfos Malaysia Sdn Bhd — centrifugal pumps, booster sets (Shah Alam, Selangor)
- KSB Pumps Sdn Bhd — process pumps, valves (Petaling Jaya, Selangor)
- WILO Malaysia Sdn Bhd — pumps, circulation systems (Shah Alam)
- Ebara Pumps Malaysia — industrial & drainage pumps (Subang Jaya)
- Sulzer Malaysia — high-duty process pumps (Kuala Lumpur)
- Flowserve Malaysia Sdn Bhd — pumps, valves, seals for oil & gas (Kuala Lumpur)
- Crane Flow Solutions (M) Sdn Bhd — industrial valves (Subang Jaya, Selangor)
- KITZ Malaysia Sdn Bhd — gate, globe, ball valves (Petaling Jaya)
- Emerson Automation Solutions Malaysia — valves, actuators, DCS (Kuala Lumpur)
- Endress+Hauser (Malaysia) Sdn Bhd — flow, level, pressure, temperature instruments (Petaling Jaya)
- Yokogawa Malaysia Sdn Bhd — process instrumentation, DCS (Kuala Lumpur)
- Honeywell Malaysia Sdn Bhd — process control, instrumentation (KL Sentral)
- ABB Malaysia Sdn Bhd — drives, motors, instrumentation (Subang Jaya)
- Siemens Malaysia Sdn Bhd — process automation, instrumentation (Petaling Jaya)
- WIKA Instruments Malaysia — pressure gauges, temperature instruments (Shah Alam)
- Parker Hannifin Malaysia Sdn Bhd — hydraulics, pneumatics, filtration (Puchong, Selangor)
- SMC Malaysia Sdn Bhd — pneumatics, solenoid valves (Shah Alam)
- Festo Malaysia Sdn Bhd — pneumatics, process valves (Shah Alam)
- Bosch Rexroth (Malaysia) — hydraulic systems (Shah Alam)
- Alfa Laval Malaysia Sdn Bhd — heat exchangers, separators (Petaling Jaya)
- Spirax Sarco Malaysia — steam systems, traps, control valves (Kuala Lumpur)
- Swagelok Malaysia — tube fittings, valves (Subang Jaya)
- Georg Fischer (GF Piping Systems) — thermoplastic & metallic piping (Shah Alam)
- Atlas Copco (Malaysia) Sdn Bhd — compressors, air systems (Subang Jaya)
- Donaldson Filtration Malaysia — industrial filtration (Petaling Jaya)
- Pall Malaysia — fine filtration, separation (Kuala Lumpur)
- SKF Malaysia Sdn Bhd — bearings, seals (Petaling Jaya)

PENANG — strong manufacturing base, good supplier coverage:
- Most Klang Valley suppliers deliver within 1–2 days
- Penang-based: Pentair Malaysia, local engineering wholesalers in Bayan Lepas FIZ
- Strong HVAC & semiconductor process fluid suppliers (due to E&E industry)

JOHOR (incl. Pengerang RAPID/PIC) — oil & gas and petrochemical focus:
- Schlumberger/Cameron Malaysia (Johor Bahru) — wellhead & process equipment
- Technip Malaysia — oil & gas engineering
- Johor Bahru industrial area: good coverage of KL suppliers via same-day logistics
- Pengerang: dedicated RAPID supply chain, most major international brands have site presence
- Sapura Industrial Sdn Bhd (JB) — structural & mechanical
- Local: Pacific Industrial Sdn Bhd, Hiap Wah Industries

TERENGGANU (Kerteh / Gebeng) — Petronas supply chain hub:
- Petronas-qualified suppliers preferred (PETRONAS Vendor Registration)
- Carigali supply chain: Uzma Berhad, Alam Maritim, Icon Offshore
- Kerteh: most major process equipment via KL delivery (2–4 hr drive)
- GEBENG Integrated Chemical Complex: dedicated chemical equipment suppliers
- Local: Kemaman Supply Base (KSB) — upstream oil & gas logistics

SABAH & SARAWAK (East Malaysia) — plan for extended lead times:
- Most suppliers deliver from KL by air (2–3 days) or sea (7–14 days)
- Local stocking distributors: Borneo Kinabalu Industrial, WTS Engineering (KK)
- Sarawak: SAMUR, Sarawak Energy supply chain, SCORE industrial zone (Tanjung Manis)
- Premium on imported goods: add 10–15% for East Malaysia logistics
- SIRIM certification and ST (Safety & Health) approval commonly required

PERAK / KEDAH / KELANTAN / PAHANG / OTHER STATES:
- Served by Klang Valley suppliers via courier/truck (1–3 days)
- Local distributors: check each state's MIDA-registered industrial suppliers
- Add 5–10% logistics premium over KV pricing for non-Klang Valley locations

PRICING BENCHMARKS (MYR, 2024–2025 Malaysian market rates, inclusive of SST where applicable):
- Exchange reference: USD 1 ≈ MYR 4.65 (include import duties 5–25% on foreign equipment)
- Centrifugal pump (end-suction, 5–15 kW): RM 3,500 – RM 18,000
- Centrifugal pump (heavy-duty process, >30 kW): RM 25,000 – RM 120,000
- Gate valve DN50 (carbon steel): RM 180 – RM 450
- Gate valve DN150 (stainless steel): RM 950 – RM 3,500
- Ball valve DN25 (SS316): RM 120 – RM 480
- Globe control valve (actuated): RM 5,500 – RM 28,000
- Pressure transmitter (4–20mA): RM 2,800 – RM 9,500
- Temperature transmitter with thermowell: RM 1,800 – RM 5,500
- Electromagnetic flow meter DN50: RM 6,500 – RM 18,000
- Pressure safety valve (spring-loaded): RM 800 – RM 4,500
- Y-strainer DN100 (SS316): RM 1,200 – RM 3,800
- Air compressor (screw, 7.5 kW): RM 6,500 – RM 14,000
- Solenoid valve DN25: RM 350 – RM 1,200
- Pipe (CS, SCH40, per meter DN100): RM 85 – RM 140
- Pipe (SS316L, SCH10S, per meter DN50): RM 180 – RM 320

COMPLIANCE STANDARDS (Malaysia-specific):
- DOSH (Dept of Occupational Safety & Health) — pressure vessels, boilers: Factories & Machinery Act 1967
- BOMBA (Fire & Rescue Dept) — fire suppression, flammable materials
- SIRIM — product certification for locally sold equipment
- DOE (Dept of Environment) — environmental compliance for chemical handling
- PETRONAS Technical Standards (PTS) — for oil & gas projects
- Malaysia Standards (MS) — e.g. MS 1745, MS 1821
- JKR (Public Works Dept) specifications — for government/infrastructure projects
`;

const SYSTEM_PROMPT = `You are a senior Malaysian industrial fluid systems engineer with 20+ years of experience working on process plants, refineries, water treatment facilities, and manufacturing plants across Malaysia.

${MALAYSIA_SUPPLIER_CONTEXT}

Your recommendations:
- Use REAL Malaysian suppliers from the directory above, selected by proximity to the project state
- Provide all monetary values in Malaysian Ringgit (MYR) using the benchmark prices above
- Determine appropriate process parameters (flow rate, pressure, temperature) from the application description — do NOT ask the user for these
- Reference Malaysian regulations (DOSH, BOMBA, SIRIM, DOE, PETRONAS PTS) where applicable
- Consider tropical climate, humidity, and corrosion for outdoor equipment in Malaysia

═══════════════════════════════════════════════════════════════════
ABSOLUTE OUTPUT REQUIREMENT — READ THIS TWICE BEFORE RESPONDING:
═══════════════════════════════════════════════════════════════════
Your entire response MUST be a single raw JSON object and NOTHING else.

PROHIBITED:
- NO markdown code fences (no \`\`\`json, no \`\`\`, never)
- NO explanatory text before the JSON
- NO explanatory text after the JSON
- NO comments inside the JSON
- NO trailing commentary like "Here is the BOM:"

REQUIRED:
- The FIRST character of your output MUST be {
- The LAST character of your output MUST be }
- Everything in between must be parseable by JSON.parse() in JavaScript

If you wrap output in markdown or add any text, the system will fail to parse it and the engineer will get an error. Output ONLY the raw JSON object.`;

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
9. COMPLETE BILL OF MATERIALS — You are producing a procurement-ready BOM, not a summary. Every item that must be purchased and installed must appear as a separate line item. Think like a process engineer walking a P&ID from fluid source to final destination: trace every pipe run, every connection, every instrument tap, every power circuit, and list what is physically needed.

MANDATORY — include ALL of the following that apply to this system. Quantity and grade are determined by scale and budget; their PRESENCE is determined by engineering necessity:

ROTATING EQUIPMENT
• Main duty pump(s) — sized to flow rate and head; specify type (centrifugal/screw/gear/diaphragm) and kW
• Standby/spare pump — include if criticality or continuous operation warrants it (most process plants: yes)
• Mechanical seals or seal pots — if applicable to pump type and fluid
• Coupling and coupling guard — for each pump-motor set

STATIC EQUIPMENT / VESSELS
• Suction header / feed tank / buffer vessel — where fluid is drawn from
• Discharge header or receiver vessel — where fluid is delivered to (if applicable)
• Expansion vessel — for closed systems (hot water, chilled water, steam condensate)
• Chemical dosing pot or quill — if chemical injection is in scope
• Separator / filter housing — if fluid requires solids removal

VALVES (every physical valve is a line item)
• Suction isolation valve — one per pump (gate or butterfly)
• Discharge isolation valve — one per pump (gate or butterfly)
• Check valve (non-return) — one per pump discharge
• Pressure relief valve (PSV) — on every pressurised header and vessel (DOSH mandatory)
• Control valve (modulating or on/off) — for flow, pressure, or temperature regulation
• Drain valve — at every low point on headers and vessels
• Vent valve — at every high point on pressurised lines
• Sample valve — at key process points if fluid requires quality sampling
• Bypass valve set — around any control valve or critical item requiring maintenance bypass

PIPING & FITTINGS (as a lot/set line item unless individual items are major cost drivers)
• Pipe — specify material, schedule, total length estimate
• Elbows, tees, reducers — as a fabrication lot
• Flanges and gaskets — as a set matching the pipe schedule
• Flexible hose / expansion joint — at pump suction and discharge to isolate vibration
• Pipe supports, clamps, hangers — sized to pipe size and span

INSTRUMENTATION (every transmitter and local gauge is a line item)
• Flow meter / flow transmitter — on main process line (FT-101)
• Pressure transmitter — pump suction (PT-101) and discharge (PT-102), and at key process points
• Local pressure gauge — at pump suction, discharge, and vessel nozzles
• Temperature transmitter or thermowell — if temperature is a process variable
• Level transmitter or level gauge — on every vessel or tank
• Differential pressure transmitter — across filters and heat exchangers if applicable
• Analytical instrument — pH, conductivity, turbidity if fluid quality monitoring is required

ELECTRICAL & CONTROL
• Motor control centre (MCC) or soft starter / VFD panel — one per motor; combine into one panel if co-located
• Control panel / local control station — for operator interface
• Power cables — from MCC to each motor (size to kW and distance)
• Instrument cables and conduit — for 4-20mA / digital signals
• Earthing / bonding system — mandatory for flammable fluids (DOSH), recommended for all

STRUCTURAL & CIVIL
• Equipment skid or base frame — for pump sets and packaged equipment
• Pipe support steelwork — for headers and long runs
• Bund / drip tray — for chemical, oil, or hazardous fluid containment (DOE requirement)
• Access platforms or ladders — if equipment is elevated

SAFETY & ANCILLARY
• Safety shower and eyewash station — if fluid is hazardous (chemical, acid, caustic)
• Fire and gas detectors — for flammable or toxic fluids (BOMBA requirement)
• Thermal insulation and cladding — for hot or cold services
• Heat tracing system — if fluid congeals or freezes at ambient temperature
• Commissioning strainer — temporary fine-mesh strainer to protect equipment during startup
• Commissioning spares kit — gaskets, seals, consumables for initial startup

SELF-CHECK BEFORE FINALISING: Review your component list against this system's P&ID mentally. Ask: "Can this system actually start up, run continuously, be isolated for maintenance, be drained, be vented, be instrumented, be controlled, be protected from overpressure, and be safely shut down — using only the components I have listed?" If any of those answers is no, add the missing items. The number of components is dictated entirely by the engineering requirements of the system at the given scale and budget. Do NOT artificially reduce the count.

HAZOP REQUIREMENTS — produce a thorough hazard analysis, not a token list:
Apply the standard HAZOP guidewords to the system's main process line and key nodes (pump suction, pump discharge, control valve, vessel, heat exchanger if present). For EACH applicable guideword that could realistically occur in this system, generate a separate risk entry:
  • NO FLOW          — blockage, valve closed, pump trip
  • MORE FLOW        — control valve fails open, bypass open
  • LESS FLOW        — partial blockage, fouled strainer
  • REVERSE FLOW     — check valve failure, pressure reversal
  • MORE PRESSURE    — blocked discharge, thermal expansion, PSV failure
  • LESS PRESSURE    — suction starvation, pump cavitation
  • MORE TEMPERATURE — loss of cooling, runaway reaction (if chemical)
  • LESS TEMPERATURE — loss of heating, freezing in cold months
  • CONTAMINATION    — wrong fluid, cross-connection, corrosion products
  • LEAK / RELEASE   — flange leak, seal failure, pipe rupture
  • LOSS OF UTILITY  — power loss, instrument air loss, cooling water loss
  • MAINTENANCE      — lockout/tagout failure, equipment isolation
  • CORROSION / EROSION — material incompatibility, high-velocity wear
  • ELECTRICAL FAULT — short circuit, VFD failure, earth fault (BOMBA-relevant)
TARGET: aim for 20 or more risk entries covering the above guidewords across system nodes. Each entry must have a distinct hazard, cause, and consequence — no duplicates. Reference DOSH FMA 1967, BOMBA UBBL fire safety, SIRIM electrical certification, or DOE environmental code in mitigations where applicable.

MANDATORY SECTIONS — these JSON blocks MUST be populated, never null or empty:
  • piping — fill with actual pipe material, diameter, schedule, connection type, and design notes
  • instrumentation — populate with AT LEAST 4 instrument tags covering essential process control:
      FT-xxx (flow transmitter on main line)
      PT-xxx (pressure transmitter on pump discharge)
      PT-xxx (pressure transmitter on pump suction, OR receiver/vessel)
      TT-xxx (temperature transmitter where thermal monitoring is relevant)
      Plus level transmitter (LT) if vessels exist, or analytical instruments (AT/QT) if chemistry matters
  • risk_assessment.risks — 20+ entries per HAZOP guidewords (see above)
  • engineering_calculations — every applicable field filled with computed numbers
If any of these sections is missing or empty, the engineer cannot use the report. Do NOT shortcut these to save tokens.

ENGINEERING CALCULATIONS — fill the engineering_calculations block with REAL numbers derived from the process parameters you set:
  • NPSHa from: atmospheric pressure + suction static head − vapour pressure − friction losses
  • TDH = static head + friction head + velocity head
  • Pump shaft power (kW) = (flow_m3_per_s × head_m × density_kg_per_m3 × 9.81) / (pump_efficiency × 1000); typical η = 0.65–0.75
  • Motor size = next standard size above shaft power (IEC: 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75 kW...)
  • Reynolds = (density × velocity × diameter_m) / viscosity_Pa_s
  • Flow regime: laminar < 2300, transitional 2300–4000, turbulent > 4000
  • Friction factor: use Colebrook or Swamee-Jain for turbulent flow
  • Pressure drop: ΔP/L = f × (ρ × v²) / (2 × D) — convert to bar/100m
These calculations PROVE the design is grounded in math, not guesswork. Take them seriously. Use water properties at the operating temperature for water systems; adjust for other fluids.

Return ONLY this JSON (fill every field with real engineering and commercial data). Keep text fields concise — 1–2 sentences maximum for notes, procedures, and descriptions. Use the token budget for complete component coverage, not verbose prose.
{
  "summary": "2-3 sentence system overview including scale and key design decisions",
  "system_type": "system classification",
  "design_basis": "key engineering considerations, scale basis, Malaysian code references",
  "overall_confidence": 85,
  "process_parameters": {
    "design_flow_rate": "e.g. 45 m³/hr",
    "operating_pressure": "e.g. 8 bar(g)",
    "design_pressure": "e.g. 12 bar(g)",
    "operating_temperature": "e.g. 65°C",
    "design_temperature": "e.g. 85°C",
    "fluid_velocity": "e.g. 2.5 m/s",
    "basis": "2-3 sentences explaining how values were determined from application and scale inputs"
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
    "notes": "Calculations per Darcy-Weisbach for water at 35°C, density 994 kg/m³, viscosity 0.72 cP. NPSH margin > 0.6 m per API 610. Motor selected one size above shaft power per IEC 60034. Heat load only for cooling/heating systems — set 0 or omit if not applicable."
  },
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
  ],
  "piping": {
    "material": "pipe material (e.g. Carbon Steel, SS316L, HDPE)",
    "nominal_diameter_inch": 2,
    "schedule": "40",
    "connection_type": "flanged|threaded|welded",
    "insulation_required": false,
    "insulation_type": null,
    "design_notes": "piping notes including corrosion allowance for Malaysian climate and sizing basis"
  },
  "instrumentation": [
    {
      "tag": "FT-101",
      "description": "Flow Transmitter — Main Process Line",
      "type": "pressure|temperature|flow|level|analytical",
      "service": "what it monitors",
      "range": "0-100 m³/hr",
      "material": "wetted material",
      "supplier": "Malaysian supplier with city",
      "unit_cost_myr": 0
    },
    {
      "tag": "PT-101",
      "description": "Pressure Transmitter — Pump Discharge",
      "type": "pressure",
      "service": "Pump discharge pressure monitoring",
      "range": "0-10 bar(g)",
      "material": "SS316 wetted parts",
      "supplier": "Malaysian supplier with city",
      "unit_cost_myr": 0
    }
  ],
  "risk_assessment": {
    "overall_risk_level": "low|medium|high|critical",
    "hazop_summary": "brief HAZOP summary with Malaysian regulatory context",
    "risks": [
      {
        "id": "R-001",
        "category": "mechanical|chemical|thermal|electrical|operational|environmental",
        "hazard": "hazard description (state the HAZOP guideword + deviation, e.g. 'NO FLOW in main discharge line')",
        "cause": "potential cause",
        "consequence": "potential consequence",
        "likelihood": "low|medium|high",
        "severity": "low|medium|high|critical",
        "risk_level": "low|medium|high|critical",
        "safeguard": "existing protection (instrumentation, PSV, interlock, procedure)",
        "mitigation": "recommended action (reference DOSH/BOMBA/SIRIM where applicable)"
      }
    ]
  },
  "maintenance_schedule": [
    {
      "frequency": "daily|weekly|monthly|quarterly|biannual|annual",
      "tasks": [
        {
          "task": "task name",
          "procedure": "brief procedure",
          "estimated_duration_hours": 1,
          "requires_shutdown": false
        }
      ]
    }
  ],
  "compliance_standards": [
    {
      "standard": "DOSH FMA 1967",
      "description": "Factories & Machinery Act — pressure vessel registration"
    }
  ],
  "cost_estimate": {
    "equipment_cost_myr": 0,
    "transportation_cost_myr": 0,
    "installation_cost_myr": 0,
    "engineering_cost_myr": 0,
    "commissioning_cost_myr": 0,
    "total_cost_myr": 0,
    "within_budget": true,
    "budget_notes": "cost summary vs RM budget; transportation calculated from supplier cities to ${state}; note any East Malaysia logistics premium"
  },
  "lead_time_weeks": 8,
  "recommended_vendors": [
    {
      "vendor": "Vendor Name",
      "specialty": "what they supply for this project",
      "region": "Malaysian city/state",
      "website_hint": "vendor.com.my or vendor.com"
    }
  ],
  "engineering_notes": "additional design recommendations, commissioning notes, Malaysian-specific considerations, confidence caveats"
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

function validateRecommendation(rec: Record<string, unknown>): void {
  const result = RecommendationSchema.safeParse(rec);
  if (!result.success) {
    // Pull out the first 3 issues for a concise error message
    const issues = result.error.issues.slice(0, 3).map((i) => {
      const path = i.path.join('.');
      return `${path}: ${i.message}`;
    }).join('; ');
    throw new Error(`AI response failed schema validation — ${issues}`);
  }
}

// ─── Model roster — tried in order until one succeeds ────────────────────────
//
// Priority order:
//  1. Gemini 2.0 Flash      — primary (free, 1M TPD, huge context)
//  2. Chutes / DeepSeek V3  — fallback (handles large prompts)

interface ModelConfig {
  provider: 'chutes' | 'gemini' | 'cerebras';
  model: string;
  max_tokens: number;
}

function buildModelRoster(): ModelConfig[] {
  const roster: ModelConfig[] = [];

  // Cerebras Qwen 235B — fast, large, returns clean JSON
  if (process.env.CEREBRAS_API_KEY) {
    roster.push({ provider: 'cerebras', model: 'qwen-3-235b-a22b-instruct-2507', max_tokens: 24000 });
  }

  return roster;
}

function clientForConfig(cfg: ModelConfig) {
  if (cfg.provider === 'chutes') return getChutesClient();
  if (cfg.provider === 'cerebras') return getCerebrasClient();
  return getGeminiClient();
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    if (
      err.message.includes('429') ||
      err.message.toLowerCase().includes('rate limit') ||
      err.message.toLowerCase().includes('too many')
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
  cfg: ModelConfig
): Promise<Record<string, unknown>> {
  const client = clientForConfig(cfg);

  console.log(`[/api/generate] trying provider=${cfg.provider} model=${cfg.model} max_tokens=${cfg.max_tokens}`);

  const completion = await client.chat.completions.create({
    model: cfg.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(input) },
    ],
    max_tokens: cfg.max_tokens,
    temperature: 0.2,
    // Force JSON-only output (supported by Gemini and DeepSeek/Chutes)
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI model');

  const recommendation = parseAIResponse(content);
  validateRecommendation(recommendation);
  return recommendation;
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
        // JSON / validation error — retry once with same model before moving on
        console.warn(`[/api/generate] parse error on ${cfg.model}, retrying once`);
        try {
          const recommendation = await generateWithModel(input, cfg);
          return NextResponse.json({ recommendation });
        } catch (retryErr) {
          lastError = retryErr;
          if (isRateLimitError(retryErr)) continue; // rate limited on retry, try next model
          // Non-rate-limit failure — try next model anyway
          console.warn(`[/api/generate] retry also failed on ${cfg.model}, trying next model`);
          continue;
        }
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
