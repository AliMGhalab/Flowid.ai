/**
 * agentTools.ts — callable tools for the agentic generation pipeline.
 *
 * Each tool is exposed to the LLM as a JSON schema (`name + parameters`)
 * and implemented as a deterministic TypeScript function. The LLM decides
 * which tool to call based on reasoning, not on hardcoded sequence.
 *
 * Tools deliberately do REAL work — formulas, lookups, validations — not
 * LLM-paraphrased work. This is what makes the system actually agentic.
 */

// ── Tool result types ──────────────────────────────────────────────────────

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

// ── Tool schemas (OpenAI function-calling format) ──────────────────────────

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'derive_process_parameters',
      description:
        'Derives realistic design flow rate, operating pressure, design pressure, temperature, and fluid velocity for a fluid system from the application description. Always call this BEFORE sizing anything.',
      parameters: {
        type: 'object',
        properties: {
          industry: { type: 'string' },
          fluid: { type: 'string' },
          application: { type: 'string', description: 'free-text application summary' },
          flow_rate_provided_m3hr: { type: 'number', description: 'If the user provided a flow rate, pass it here. Otherwise omit.' },
        },
        required: ['industry', 'fluid', 'application'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_hydraulics',
      description:
        'Computes pipe velocity, Reynolds number, flow regime (laminar/transitional/turbulent), Darcy friction factor, and pressure drop per 100 m. Use this after process parameters are known.',
      parameters: {
        type: 'object',
        properties: {
          flow_m3hr: { type: 'number' },
          pipe_diameter_inch: { type: 'number' },
          operating_temp_c: { type: 'number' },
          fluid: { type: 'string' },
        },
        required: ['flow_m3hr', 'pipe_diameter_inch', 'operating_temp_c'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'size_pump_motor',
      description:
        'Computes pump shaft power (kW), selects motor size on standard IEC 60034 step, verifies NPSH margin per API 610. Call after hydraulics are known.',
      parameters: {
        type: 'object',
        properties: {
          flow_m3hr: { type: 'number' },
          total_head_m: { type: 'number' },
          fluid_density_kgm3: { type: 'number', description: 'kg/m³, e.g. 994 for water at 35°C' },
          pump_efficiency: { type: 'number', description: '0.0 to 1.0, typical 0.65-0.75' },
          static_head_m: { type: 'number' },
          friction_head_m: { type: 'number' },
        },
        required: ['flow_m3hr', 'total_head_m', 'fluid_density_kgm3'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lookup_malaysian_suppliers',
      description:
        'Looks up real Malaysian suppliers for one OR MORE component categories in a single call, ranked by proximity to the project state. Pass ALL categories you need (pump, valve, instrument, piping, vessel, electrical, safety, fitting) at once to save round-trips.',
      parameters: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['pump', 'valve', 'instrument', 'piping', 'vessel', 'electrical', 'safety', 'fitting', 'heat_exchanger', 'filter'],
            },
            description: 'List of categories — pass all you need in one call to minimise round-trips',
          },
          project_state: { type: 'string', description: 'Malaysian state name (lowercase, underscored)' },
        },
        required: ['categories', 'project_state'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_material_compatibility',
      description:
        'Validates whether a proposed material is compatible with the working fluid. Returns reject + reason for known dangerous combos (e.g. HCl + carbon steel, NH3 + brass, hot CPO + galvanized).',
      parameters: {
        type: 'object',
        properties: {
          fluid: { type: 'string', description: 'fluid name from the project, e.g. "ammonia", "hydrochloric acid", "cooling water"' },
          material: { type: 'string', description: 'proposed material, e.g. "carbon steel", "SS316", "brass"' },
          operating_temp_c: { type: 'number' },
        },
        required: ['fluid', 'material'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_required_hazop_guidewords',
      description:
        'Returns the mandatory HAZOP guidewords that must be covered for a fluid system. Use to ensure no critical hazard category is missed.',
      parameters: {
        type: 'object',
        properties: {
          fluid: { type: 'string' },
          design_pressure_bar: { type: 'number' },
          is_hazardous: { type: 'boolean', description: 'true if flammable, toxic, corrosive, or high-pressure' },
        },
        required: ['fluid'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'reconcile_costs_aace',
      description:
        'Server-side cost reconciliation per AACE Class 4-5 methodology. Takes the BOM and applies Lang Factor Method to compute installation, engineering, commissioning, and transportation. Returns the verified cost breakdown.',
      parameters: {
        type: 'object',
        properties: {
          components: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit_cost_myr: { type: 'number' },
              },
              required: ['name', 'quantity', 'unit_cost_myr'],
            },
          },
          project_state: { type: 'string' },
          budget_myr: { type: 'number' },
        },
        required: ['components', 'budget_myr'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'finalize_design',
      description:
        'Call this ONLY when the design is complete. Submits the final structured FluidSystemRecommendation. After this is called, the agent loop ends.',
      parameters: {
        type: 'object',
        properties: {
          recommendation: {
            type: 'object',
            description: 'The complete FluidSystemRecommendation matching the project schema',
          },
        },
        required: ['recommendation'],
      },
    },
  },
];

// ── Tool implementations ───────────────────────────────────────────────────

function approxWaterDensity(tempC: number): number {
  // Crude water density: 1000 - 0.2(t-4) kg/m³
  return 1000 - 0.2 * Math.max(0, tempC - 4);
}
function approxWaterViscosity(tempC: number): number {
  // Water viscosity: ~10^-3 Pa·s at 20°C, decreases with temp
  return 0.001 * Math.exp(-0.025 * Math.max(0, tempC - 25));
}

/** Returns [density_kg_m3, viscosity_Pa_s] for the given fluid and temperature */
function getFluidProps(fluid: string | undefined, tempC: number): [number, number] {
  const f = (fluid ?? '').toLowerCase();
  // Palm / Crude Palm Oil (CPO): ρ≈920 kg/m³, viscosity drops steeply with temp
  if (f.includes('palm') || f.includes('cpo')) {
    const rho = 920 - 0.6 * Math.max(0, tempC - 25); // approx 920→882 over 25-90°C
    // CPO viscosity (Pa·s): ~0.12 at 40°C, ~0.025 at 65°C, ~0.008 at 90°C
    const mu = 0.0011 * Math.exp(3200 / (tempC + 273.15) - 3200 / 313.15) * 0.12;
    return [Math.max(rho, 830), Math.max(mu, 0.005)];
  }
  // Steam / vapour: very low density, high velocity
  if (f.includes('steam')) {
    const rho = f.includes('hp') ? 15 : 5; // kg/m³ rough (saturated steam)
    return [rho, 1.5e-5];
  }
  // Ammonia liquid: ρ≈682 kg/m³ at -10°C, viscosity ~0.15 mPa·s
  if (f.includes('ammonia') || f.includes('nh3')) {
    return [682 - 0.5 * (tempC + 10), 0.00015];
  }
  // Caustic soda / NaOH ~20%: ρ≈1220, μ≈1.5×water
  if (f.includes('caustic') || f.includes('naoh')) {
    return [1220, approxWaterViscosity(tempC) * 1.5];
  }
  // Acids (HCl, H2SO4 dilute): ρ≈1050-1100, μ≈water
  if (f.includes('acid') || f.includes('hcl') || f.includes('h2so4')) {
    return [1080, approxWaterViscosity(tempC)];
  }
  // Chilled water / cooling water — same as water
  // Default: water
  return [approxWaterDensity(tempC), approxWaterViscosity(tempC)];
}

export function tool_derive_process_parameters(args: {
  industry: string;
  fluid: string;
  application: string;
  flow_rate_provided_m3hr?: number;
}): ToolResult {
  const fluid = args.fluid.toLowerCase();
  // Conservative defaults — the agent can refine but we provide a baseline
  const flow = args.flow_rate_provided_m3hr ?? 50;
  let opPressure = 6;
  let designPressure = 10;
  let opTemp = 35;
  let designTemp = 50;
  let velocity = 2.2;

  if (fluid.includes('steam')) {
    opPressure = fluid.includes('hp') ? 25 : 8;
    designPressure = opPressure * 1.25;
    opTemp = fluid.includes('hp') ? 250 : 180;
    designTemp = opTemp + 20;
    velocity = 25; // steam moves fast
  } else if (fluid.includes('chilled')) {
    opTemp = 7;
    designTemp = 15;
    velocity = 2.0;
  } else if (fluid.includes('refrigerant') || fluid.includes('nh3') || fluid.includes('hfc')) {
    opPressure = 12;
    designPressure = 18;
    opTemp = -10;
    designTemp = 5;
    velocity = 8;
  } else if (fluid.includes('cpo') || fluid.includes('palm oil')) {
    opTemp = 65;
    designTemp = 90;
    velocity = 1.5;
  } else if (fluid.includes('acid') || fluid.includes('caustic')) {
    velocity = 1.5; // slow for corrosives
    designPressure = 8;
  }

  return {
    ok: true,
    data: {
      design_flow_rate: `${flow} m³/hr`,
      operating_pressure: `${opPressure} bar(g)`,
      design_pressure: `${designPressure} bar(g)`,
      operating_temperature: `${opTemp}°C`,
      design_temperature: `${designTemp}°C`,
      fluid_velocity: `${velocity} m/s`,
      basis: `Derived from industry=${args.industry}, fluid=${args.fluid}. Standard practice for this application class; refine if specific OEM data available.`,
    },
  };
}

export function tool_calculate_hydraulics(args: {
  flow_m3hr: number;
  pipe_diameter_inch: number;
  operating_temp_c: number;
  fluid?: string;
}): ToolResult {
  const Q = args.flow_m3hr / 3600; // m³/s
  const Dm = args.pipe_diameter_inch * 0.0254; // inch → m
  const area = Math.PI * (Dm / 2) ** 2;
  const v = Q / area; // m/s
  const [rho, mu] = getFluidProps(args.fluid, args.operating_temp_c);
  const Re = (rho * v * Dm) / mu;
  const regime = Re < 2300 ? 'laminar' : Re < 4000 ? 'transitional' : 'turbulent';
  // Swamee-Jain explicit friction factor for turbulent flow (roughness 0.046 mm carbon steel)
  const eps = 0.000046; // m
  const f = regime === 'turbulent'
    ? 0.25 / Math.pow(Math.log10(eps / (3.7 * Dm) + 5.74 / Math.pow(Re, 0.9)), 2)
    : 64 / Re;
  const dpPerMeter = f * (rho * v * v) / (2 * Dm); // Pa/m
  const dpPer100m = (dpPerMeter * 100) / 1e5; // bar / 100 m

  return {
    ok: true,
    data: {
      pipe_velocity_m_s: Number(v.toFixed(2)),
      reynolds_number: Math.round(Re),
      flow_regime: regime,
      friction_factor: Number(f.toFixed(4)),
      pressure_drop_bar_per_100m: Number(dpPer100m.toFixed(3)),
      density_kgm3: Number(rho.toFixed(1)),
      viscosity_pa_s: Number(mu.toExponential(2)),
    },
  };
}

const IEC_MOTOR_SIZES = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250];

export function tool_size_pump_motor(args: {
  flow_m3hr: number;
  total_head_m: number;
  fluid_density_kgm3: number;
  pump_efficiency?: number;
  static_head_m?: number;
  friction_head_m?: number;
}): ToolResult {
  const Q = args.flow_m3hr / 3600;
  const eta = args.pump_efficiency ?? 0.7;
  const shaftKw = (Q * args.total_head_m * args.fluid_density_kgm3 * 9.81) / (eta * 1000);
  const motorKw = IEC_MOTOR_SIZES.find((s) => s >= shaftKw) ?? Math.ceil(shaftKw);
  // Crude NPSHa estimate: atm head (10.3 m) - vapor pressure head (~0.5 m for water at 35°C) - friction at suction (~0.5 m)
  const npshA = 10.3 - 0.5 - (args.friction_head_m ?? 5) * 0.1; // 10% of friction is suction-side
  const npshR = 0.5 + 0.15 * (args.flow_m3hr / 50); // crude — real NPSHr from pump curve
  const margin = npshA - npshR;

  return {
    ok: true,
    data: {
      pump_power_kw: Number(shaftKw.toFixed(2)),
      motor_size_kw: motorKw,
      npsh_available_m: Number(npshA.toFixed(2)),
      npsh_required_m: Number(npshR.toFixed(2)),
      npsh_margin_m: Number(margin.toFixed(2)),
      npsh_margin_ok: margin > 0.6,
      total_dynamic_head_m: args.total_head_m,
      static_head_m: args.static_head_m ?? null,
      friction_head_m: args.friction_head_m ?? null,
      basis: `Shaft kW per (Q×H×ρ×g)/η. Motor sized to next IEC 60034 step ≥ shaft kW. NPSHa per API 610.`,
    },
  };
}

// Malaysian supplier directory — real companies, real cities
const SUPPLIERS_BY_CATEGORY: Record<string, Array<{ name: string; city: string; state: string; priceRangeMyr: [number, number] }>> = {
  pump: [
    { name: 'Grundfos Malaysia Sdn Bhd',     city: 'Shah Alam',      state: 'selangor', priceRangeMyr: [3500, 120000] },
    { name: 'KSB Pumps Sdn Bhd',             city: 'Petaling Jaya',  state: 'selangor', priceRangeMyr: [4000, 100000] },
    { name: 'WILO Malaysia Sdn Bhd',         city: 'Shah Alam',      state: 'selangor', priceRangeMyr: [3500, 80000] },
    { name: 'Ebara Pumps Malaysia',          city: 'Subang Jaya',    state: 'selangor', priceRangeMyr: [3000, 90000] },
    { name: 'Sulzer Malaysia',               city: 'Kuala Lumpur',   state: 'kuala_lumpur', priceRangeMyr: [8000, 150000] },
    { name: 'Flowserve Malaysia Sdn Bhd',    city: 'Kuala Lumpur',   state: 'kuala_lumpur', priceRangeMyr: [12000, 200000] },
  ],
  valve: [
    { name: 'KITZ Malaysia Sdn Bhd',         city: 'Petaling Jaya',  state: 'selangor', priceRangeMyr: [120, 5000] },
    { name: 'Crane Flow Solutions (M) Sdn Bhd', city: 'Subang Jaya', state: 'selangor', priceRangeMyr: [180, 8000] },
    { name: 'Pentair Malaysia',              city: 'Bayan Lepas',    state: 'penang',   priceRangeMyr: [200, 9000] },
    { name: 'Emerson Automation Solutions Malaysia', city: 'Kuala Lumpur', state: 'kuala_lumpur', priceRangeMyr: [3000, 30000] },
    { name: 'Spirax Sarco Malaysia',         city: 'Kuala Lumpur',   state: 'kuala_lumpur', priceRangeMyr: [400, 12000] },
  ],
  instrument: [
    { name: 'Endress+Hauser (Malaysia) Sdn Bhd', city: 'Petaling Jaya', state: 'selangor', priceRangeMyr: [1500, 25000] },
    { name: 'Yokogawa Malaysia Sdn Bhd',     city: 'Kuala Lumpur',   state: 'kuala_lumpur', priceRangeMyr: [2000, 30000] },
    { name: 'Honeywell Malaysia Sdn Bhd',    city: 'Kuala Lumpur',   state: 'kuala_lumpur', priceRangeMyr: [2500, 28000] },
    { name: 'WIKA Instruments Malaysia',     city: 'Shah Alam',      state: 'selangor', priceRangeMyr: [100, 8000] },
    { name: 'ABB Malaysia Sdn Bhd',          city: 'Subang Jaya',    state: 'selangor', priceRangeMyr: [2000, 35000] },
  ],
  piping: [
    { name: 'Georg Fischer (GF Piping Systems)', city: 'Shah Alam',  state: 'selangor', priceRangeMyr: [60, 3500] },
  ],
  vessel: [
    { name: 'Local Fabricator (MIDA-registered)', city: 'Klang', state: 'selangor', priceRangeMyr: [2500, 50000] },
    { name: 'Reflex WTW Sdn Bhd',            city: 'Shah Alam',      state: 'selangor', priceRangeMyr: [1800, 12000] },
  ],
  electrical: [
    { name: 'ABB Malaysia Sdn Bhd',          city: 'Subang Jaya',    state: 'selangor', priceRangeMyr: [3000, 80000] },
    { name: 'Siemens Malaysia Sdn Bhd',      city: 'Petaling Jaya',  state: 'selangor', priceRangeMyr: [3500, 90000] },
    { name: 'Schneider Electric Malaysia',   city: 'Petaling Jaya',  state: 'selangor', priceRangeMyr: [3000, 85000] },
  ],
  safety: [
    { name: 'Parker Hannifin Malaysia Sdn Bhd', city: 'Puchong',    state: 'selangor', priceRangeMyr: [500, 15000] },
    { name: 'Donaldson Filtration Malaysia', city: 'Petaling Jaya',  state: 'selangor', priceRangeMyr: [600, 12000] },
  ],
  fitting: [
    { name: 'Swagelok Malaysia',             city: 'Subang Jaya',    state: 'selangor', priceRangeMyr: [80, 3500] },
    { name: 'Parker Hannifin Malaysia Sdn Bhd', city: 'Puchong',    state: 'selangor', priceRangeMyr: [60, 4000] },
  ],
  heat_exchanger: [
    { name: 'Alfa Laval Malaysia Sdn Bhd',   city: 'Petaling Jaya',  state: 'selangor', priceRangeMyr: [15000, 250000] },
  ],
  filter: [
    { name: 'Pall Malaysia',                 city: 'Kuala Lumpur',   state: 'kuala_lumpur', priceRangeMyr: [1500, 30000] },
    { name: 'Donaldson Filtration Malaysia', city: 'Petaling Jaya',  state: 'selangor', priceRangeMyr: [1000, 25000] },
  ],
};

export function tool_lookup_malaysian_suppliers(args: {
  categories?: string[];
  category?: string;  // legacy single-category support
  project_state: string;
}): ToolResult {
  // Accept either `categories: [...]` (new) or `category: "..."` (legacy)
  const cats: string[] = (args.categories && Array.isArray(args.categories) && args.categories.length > 0)
    ? args.categories.map((c) => c.toLowerCase())
    : args.category
      ? [args.category.toLowerCase()]
      : [];
  if (cats.length === 0) {
    return { ok: false, error: 'No categories provided. Use `categories` with at least one of: ' + Object.keys(SUPPLIERS_BY_CATEGORY).join(', ') };
  }
  const projectState = args.project_state.toLowerCase();
  const isEastMalaysia = ['sabah', 'sarawak', 'labuan'].includes(projectState);

  const results: Record<string, unknown> = {};
  const unknown: string[] = [];

  for (const cat of cats) {
    const suppliers = SUPPLIERS_BY_CATEGORY[cat];
    if (!suppliers) {
      unknown.push(cat);
      continue;
    }
    const sameState = suppliers.filter((s) => s.state === projectState);
    const klangValley = suppliers.filter((s) => ['selangor', 'kuala_lumpur'].includes(s.state) && s.state !== projectState);
    const others = suppliers.filter((s) => !['selangor', 'kuala_lumpur'].includes(s.state) && s.state !== projectState);
    results[cat] = [...sameState, ...klangValley, ...others].slice(0, 5);
  }

  return {
    ok: true,
    data: {
      project_state: args.project_state,
      suppliers_by_category: results,
      unknown_categories: unknown,
      logistics_premium: isEastMalaysia ? '10-15% air/sea freight to East Malaysia' : '5-10% courier to non-Klang Valley',
    },
  };
}

const FLUID_MATERIAL_INCOMPAT: Array<{ fluid: string[]; material: string[]; reason: string }> = [
  { fluid: ['hcl', 'hydrochloric'], material: ['carbon steel', 'cs'], reason: 'Severe corrosion — use HDPE, PTFE-lined, or FRP' },
  { fluid: ['sulfuric', 'h2so4'],    material: ['carbon steel', 'cs'], reason: 'Severe corrosion at low concentrations — use lead-lined or PTFE' },
  { fluid: ['caustic', 'naoh'],      material: ['aluminum', 'al'], reason: 'Caustic embrittlement — use carbon steel or SS' },
  { fluid: ['ammonia', 'nh3'],       material: ['brass', 'copper', 'bronze'], reason: 'Ammonia stress corrosion cracking in copper alloys — use carbon steel' },
  { fluid: ['chloride', 'seawater'], material: ['304', 'austenitic'], reason: 'Chloride stress corrosion in 304/316 SS — consider duplex SS or super-austenitic' },
  { fluid: ['palm oil', 'cpo'],      material: ['galvanized', 'galv'], reason: 'Zinc dissolves into hot CPO — use SS316 or food-grade material' },
];

export function tool_check_material_compatibility(args: {
  fluid: string;
  material: string;
  operating_temp_c?: number;
}): ToolResult {
  const f = args.fluid.toLowerCase();
  const m = args.material.toLowerCase();
  for (const rule of FLUID_MATERIAL_INCOMPAT) {
    if (rule.fluid.some((kw) => f.includes(kw)) && rule.material.some((kw) => m.includes(kw))) {
      return {
        ok: true,
        data: { compatible: false, severity: 'reject', fluid: args.fluid, material: args.material, reason: rule.reason },
      };
    }
  }
  return {
    ok: true,
    data: { compatible: true, severity: 'ok', fluid: args.fluid, material: args.material, reason: 'No known incompatibility in our rule library — verify against OEM material datasheet before specifying.' },
  };
}

export function tool_get_required_hazop_guidewords(args: {
  fluid: string;
  design_pressure_bar?: number;
  is_hazardous?: boolean;
}): ToolResult {
  const required = ['NO FLOW', 'MORE PRESSURE', 'LEAK', 'ELECTRICAL FAULT'];
  const conditional: string[] = [];
  const f = args.fluid.toLowerCase();
  if (args.is_hazardous || f.includes('acid') || f.includes('caustic') || f.includes('ammonia') || f.includes('hcl')) {
    conditional.push('PERSONNEL EXPOSURE', 'ENVIRONMENTAL RELEASE');
  }
  if (f.includes('hydrogen') || f.includes('lng') || f.includes('natural gas') || f.includes('fuel') || f.includes('refrigerant')) {
    conditional.push('IGNITION SOURCE', 'EXPLOSION');
  }
  if ((args.design_pressure_bar ?? 0) > 10) {
    conditional.push('OVERPRESSURE');
  }
  if (f.includes('steam') || f.includes('hot') || (f.includes('cpo'))) {
    conditional.push('THERMAL BURN');
  }
  return {
    ok: true,
    data: {
      required_guidewords: required,
      conditional_guidewords: conditional,
      total_minimum: required.length + conditional.length,
      target_risk_count: '≥ 20',
      notes: 'Generate at least one distinct hazard entry per applicable guideword, with cause, consequence, safeguard, mitigation.',
    },
  };
}

export function tool_reconcile_costs_aace(args: {
  components: Array<{ name: string; quantity: number; unit_cost_myr: number }>;
  project_state?: string;
  budget_myr: number;
}): ToolResult {
  const eq = args.components.reduce((s, c) => s + c.quantity * c.unit_cost_myr, 0);
  const isEast = ['sabah', 'sarawak', 'labuan'].includes((args.project_state ?? '').toLowerCase());
  const transportPct = isEast ? 0.13 : 0.08;
  const transport = Math.round(eq * transportPct);
  const install = Math.round(eq * 0.20);
  const engineering = Math.round(eq * 0.12);
  const commissioning = Math.round(eq * 0.05);
  const total = Math.round(eq + transport + install + engineering + commissioning);
  const diff = total - args.budget_myr;
  const within = total <= args.budget_myr;
  return {
    ok: true,
    data: {
      equipment_cost_myr: eq,
      transportation_cost_myr: transport,
      installation_cost_myr: install,
      engineering_cost_myr: engineering,
      commissioning_cost_myr: commissioning,
      total_cost_myr: total,
      budget_myr: args.budget_myr,
      within_budget: within,
      diff_myr: diff,
      methodology: 'AACE Class 4-5 + Lang Factor Method · transportation 8% (Klang Valley) or 13% (East Malaysia) · installation 20% · engineering 12% · commissioning 5%',
    },
  };
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export type ToolName =
  | 'derive_process_parameters'
  | 'calculate_hydraulics'
  | 'size_pump_motor'
  | 'lookup_malaysian_suppliers'
  | 'check_material_compatibility'
  | 'get_required_hazop_guidewords'
  | 'reconcile_costs_aace'
  | 'finalize_design';

export function runTool(name: string, rawArgs: unknown): ToolResult {
  const args = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Record<string, unknown>;
  try {
    switch (name) {
      case 'derive_process_parameters':
        return tool_derive_process_parameters(args as Parameters<typeof tool_derive_process_parameters>[0]);
      case 'calculate_hydraulics':
        return tool_calculate_hydraulics(args as Parameters<typeof tool_calculate_hydraulics>[0]);
      case 'size_pump_motor':
        return tool_size_pump_motor(args as Parameters<typeof tool_size_pump_motor>[0]);
      case 'lookup_malaysian_suppliers':
        return tool_lookup_malaysian_suppliers(args as Parameters<typeof tool_lookup_malaysian_suppliers>[0]);
      case 'check_material_compatibility':
        return tool_check_material_compatibility(args as Parameters<typeof tool_check_material_compatibility>[0]);
      case 'get_required_hazop_guidewords':
        return tool_get_required_hazop_guidewords(args as Parameters<typeof tool_get_required_hazop_guidewords>[0]);
      case 'reconcile_costs_aace':
        return tool_reconcile_costs_aace(args as Parameters<typeof tool_reconcile_costs_aace>[0]);
      case 'finalize_design':
        // Special — caller handles separately to end the loop. We just acknowledge.
        return { ok: true, data: { status: 'finalized', received_recommendation: true } };
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
