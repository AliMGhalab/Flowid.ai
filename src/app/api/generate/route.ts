import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ProjectInput } from '@/types';

export const maxDuration = 120;

function getClient() {
  return new OpenAI({
    apiKey: process.env.CHUTES_API_KEY ?? 'placeholder',
    baseURL: 'https://llm.chutes.ai/v1',
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

function buildPrompt(input: ProjectInput): string {
  const fluidName =
    input.fluidType === 'chemical' || input.fluidType === 'other'
      ? input.customFluidType
      : input.fluidType.replace(/_/g, ' ');

  const state = stateLabel(input.malaysiaState);
  const env = input.siteEnvironment.replace(/_/g, ' ');

  return `Design a complete industrial fluid system for a project in ${state}, Malaysia.

PROJECT: ${input.projectName}
INDUSTRY: ${input.industry}
APPLICATION: ${input.application}
FLUID: ${fluidName}
SITE: ${env}
BUDGET: RM ${input.budget.toLocaleString()} MYR
SPECIAL REQUIREMENTS: ${input.specialRequirements || 'None'}
LOCATION: ${state}, Malaysia — select suppliers closest to this state

INSTRUCTIONS:
1. Determine all process parameters (flow rate, pressure, temperature, pipe size) from the application description. Explain your engineering basis.
2. All costs in MYR. Use Malaysian market prices including SST and local logistics.
3. For suppliers: pick brands with offices or distributors nearest to ${state}. If in East Malaysia, account for extra logistics cost.
4. Apply relevant Malaysian regulations (DOSH, BOMBA, SIRIM, DOE, PETRONAS PTS as applicable).
5. For EVERY component, provide exactly 2 alternatives from DIFFERENT Malaysian suppliers with realistic MYR costs. Alternatives should offer genuine trade-offs (e.g. cost saving, faster local availability, equivalent spec from a competing brand).

Return ONLY this JSON (fill every field with real engineering and commercial data):
{
  "summary": "2-3 sentence system overview",
  "system_type": "system classification",
  "design_basis": "key engineering considerations, Malaysian code references",
  "process_parameters": {
    "design_flow_rate": "e.g. 45 m³/hr",
    "operating_pressure": "e.g. 8 bar(g)",
    "design_pressure": "e.g. 12 bar(g)",
    "operating_temperature": "e.g. 65°C",
    "design_temperature": "e.g. 85°C",
    "fluid_velocity": "e.g. 2.5 m/s",
    "basis": "2-3 sentences explaining how these values were determined from the application"
  },
  "components": [
    {
      "id": "C-001",
      "name": "descriptive component name",
      "category": "pump|valve|filter|vessel|fitting|electrical|safety|other",
      "quantity": 1,
      "specification": "full technical spec: size, rating, material, performance",
      "material": "material of construction and reason",
      "supplier": "real Malaysian supplier name and city",
      "model": "real model/series example",
      "unit_cost_myr": 0,
      "total_cost_myr": 0,
      "notes": "selection rationale, Malaysian compliance note if applicable",
      "alternatives": [
        {
          "name": "alternative component name",
          "supplier": "alternative Malaysian supplier",
          "model": "alternative model",
          "reason": "why this is a viable alternative (cost saving, faster delivery, local stock, etc.)",
          "unit_cost_myr": 0,
          "total_cost_myr": 0
        },
        {
          "name": "second alternative component name",
          "supplier": "second alternative Malaysian supplier",
          "model": "second alternative model",
          "reason": "why this is a viable alternative",
          "unit_cost_myr": 0,
          "total_cost_myr": 0
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
    "design_notes": "piping notes including corrosion allowance for Malaysian climate"
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
    "installation_cost_myr": 0,
    "engineering_cost_myr": 0,
    "commissioning_cost_myr": 0,
    "total_cost_myr": 0,
    "within_budget": true,
    "budget_notes": "cost summary vs RM budget, note if East Malaysia logistics premium applied"
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
  "engineering_notes": "additional design recommendations, commissioning notes, Malaysian-specific considerations"
}`;
}

export async function POST(request: NextRequest) {
  try {
    const input: ProjectInput = await request.json();

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: 'deepseek-ai/DeepSeek-V3.2-TEE',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(input) },
      ],
      max_tokens: 8192,
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI model');

    let jsonStr = content.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const recommendation = JSON.parse(jsonStr);
    return NextResponse.json({ recommendation });
  } catch (error) {
    console.error('[/api/generate]', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'AI returned malformed JSON. Please try again.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
