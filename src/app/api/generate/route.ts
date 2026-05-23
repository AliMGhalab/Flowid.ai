import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ProjectInput } from '@/types';

export const maxDuration = 120;

function getClient() {
  // Uses Groq (free) by default; swap to Chutes when credits are added
  const groqKey = process.env.GROQ_API_KEY;
  const chutesKey = process.env.CHUTES_API_KEY;

  if (chutesKey) {
    return new OpenAI({
      apiKey: chutesKey,
      baseURL: 'https://llm.chutes.ai/v1',
    });
  }

  return new OpenAI({
    apiKey: groqKey ?? 'placeholder',
    baseURL: 'https://api.groq.com/openai/v1',
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

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no text outside the JSON.`;

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
    "material": "pipe material",
    "nominal_diameter_inch": 2,
    "schedule": "40",
    "connection_type": "flanged|threaded|welded",
    "insulation_required": false,
    "insulation_type": null,
    "design_notes": "piping notes including corrosion allowance for Malaysian climate and sizing basis"
  },
  "instrumentation": [
    {
      "tag": "PT-101",
      "description": "Pressure Transmitter — Pump Discharge",
      "type": "pressure|temperature|flow|level|analytical",
      "service": "what it monitors",
      "range": "0-150 PSI",
      "material": "316 SS wetted parts",
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
        "hazard": "hazard description",
        "cause": "potential cause",
        "consequence": "potential consequence",
        "likelihood": "low|medium|high",
        "severity": "low|medium|high|critical",
        "risk_level": "low|medium|high|critical",
        "safeguard": "existing protection",
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

  // Strip markdown code fences
  const fenceMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) s = fenceMatch[1].trim();

  // If it doesn't start with '{', try to find the first '{'
  const braceStart = s.indexOf('{');
  if (braceStart > 0) s = s.slice(braceStart);

  return s;
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
  const required = ['summary', 'system_type', 'components', 'cost_estimate'];
  for (const field of required) {
    if (!rec[field]) throw new Error(`AI response missing required field: "${field}"`);
  }
  if (!Array.isArray(rec.components)) throw new Error('AI response "components" is not an array');
  if ((rec.components as unknown[]).length === 0) throw new Error('AI response returned zero components');
}

// ─── Single generation attempt ────────────────────────────────────────────────

async function generate(input: ProjectInput): Promise<Record<string, unknown>> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: process.env.CHUTES_API_KEY
      ? 'deepseek-ai/DeepSeek-V3.2-TEE'
      : 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(input) },
    ],
    max_tokens: 16000,
    temperature: 0.2,
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

    // Attempt 1
    let recommendation: Record<string, unknown>;
    try {
      recommendation = await generate(input);
    } catch (firstErr) {
      console.warn('[/api/generate] first attempt failed:', firstErr);
      // Attempt 2 — single retry
      try {
        recommendation = await generate(input);
      } catch (secondErr) {
        console.error('[/api/generate] second attempt failed:', secondErr);
        throw secondErr;
      }
    }

    return NextResponse.json({ recommendation });
  } catch (error) {
    console.error('[/api/generate]', error);
    const message =
      error instanceof Error ? error.message : 'Generation failed';
    const isMalformed =
      error instanceof SyntaxError || message.includes('JSON') || message.includes('field');
    return NextResponse.json(
      { error: isMalformed ? 'AI returned an incomplete response. Please try again.' : message },
      { status: 500 }
    );
  }
}
