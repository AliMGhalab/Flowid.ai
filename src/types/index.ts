export interface ProjectInput {
  projectName: string;
  malaysiaState: string;
  siteEnvironment: string;
  fluidType: string;
  customFluidType?: string;
  application: string;
  industry: string;
  budget: number;
  specialRequirements?: string;
  // Scale
  scaleFlowRateValue?: number;
  scaleFlowRateUnit?: 'L/min' | 'm³/hr' | 'GPM';
  scaleVolumeMonthlyValue?: number;
  scaleVolumeMonthlyUnit?: 'm³/month' | 'L/month' | 'gallons/month';
}

export interface ProcessParameters {
  design_flow_rate: string;
  operating_pressure: string;
  design_pressure: string;
  operating_temperature: string;
  design_temperature: string;
  fluid_velocity: string;
  basis: string;
}

export interface ComponentAlternative {
  name: string;
  supplier: string;
  model: string;
  reason: string;
  unit_cost_myr: number;
  total_cost_myr: number;
  confidence_level?: number;
}

export interface SystemComponent {
  id: string;
  name: string;
  category: string;
  quantity: number;
  specification: string;
  material: string;
  supplier: string;
  model: string;
  // MYR fields
  unit_cost_myr?: number;
  total_cost_myr?: number;
  // USD fields (legacy fallback)
  unit_cost_usd?: number;
  total_cost_usd?: number;
  notes: string;
  alternatives?: ComponentAlternative[];
  // New fields
  confidence_level?: number;      // 0–100: AI confidence this is the right choice
  lifespan_years?: number;        // Expected years before replacement/major overhaul
  lifespan_notes?: string;        // Conditions affecting lifespan
  price_basis?: string;           // Where the price comes from (catalog, region, currency basis, date)
}

export interface EngineeringCalculations {
  // Pump hydraulics
  npsh_available_m?: number;          // Net Positive Suction Head Available (m)
  npsh_required_m?: number;           // Manufacturer's NPSHr at duty point (m)
  npsh_margin_m?: number;             // NPSHa - NPSHr; should be > 0.6 m
  total_dynamic_head_m?: number;      // TDH at duty point (m)
  static_head_m?: number;             // Elevation head (m)
  friction_head_m?: number;           // Pipe + fittings losses (m)
  pump_power_kw?: number;             // Calculated shaft power (kW)
  motor_size_kw?: number;             // Selected motor size (kW)
  // Piping hydraulics
  pipe_velocity_m_s?: number;         // Fluid velocity in main line (m/s)
  reynolds_number?: number;           // Re — turbulent if > 4000
  flow_regime?: 'laminar' | 'transitional' | 'turbulent';
  friction_factor?: number;           // Darcy friction factor (dimensionless)
  pressure_drop_bar_per_100m?: number; // Pressure drop per 100 m of pipe (bar)
  // Process
  heat_load_kw?: number;              // For cooling/heating systems
  notes?: string;                     // Engineering assumptions, formulas used, references
}

export interface Instrument {
  tag: string;
  description: string;
  type: string;
  service: string;
  range: string;
  material: string;
  supplier: string;
  unit_cost_myr?: number;
  unit_cost_usd?: number;
}

export interface Risk {
  id: string;
  category: string;
  hazard: string;
  cause: string;
  consequence: string;
  likelihood: 'low' | 'medium' | 'high';
  severity: 'low' | 'medium' | 'high' | 'critical';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  safeguard: string;
  mitigation: string;
}

export interface MaintenanceTask {
  task: string;
  procedure: string;
  estimated_duration_hours: number;
  requires_shutdown: boolean;
}

export interface MaintenanceSchedule {
  frequency: string;
  tasks: MaintenanceTask[];
}

export interface ComplianceStandard {
  standard: string;
  description: string;
}

export interface Vendor {
  vendor: string;
  specialty: string;
  region: string;
  website_hint: string;
}

export interface PipingSpec {
  material: string;
  nominal_diameter_inch: number;
  schedule: string;
  connection_type: string;
  insulation_required: boolean;
  insulation_type: string | null;
  design_notes: string;
}

export interface CostEstimate {
  equipment_cost_myr?: number;
  transportation_cost_myr?: number;
  installation_cost_myr?: number;
  engineering_cost_myr?: number;
  commissioning_cost_myr?: number;
  total_cost_myr?: number;
  // legacy USD fallback
  equipment_cost_usd?: number;
  installation_cost_usd?: number;
  engineering_cost_usd?: number;
  commissioning_cost_usd?: number;
  total_cost_usd?: number;
  within_budget: boolean;
  budget_notes: string;
  cost_basis?: string;  // Server-added: explains how equipment cost was derived (from BOM sum, etc.)
}

export interface LivePriceResult {
  componentId: string;
  found: boolean;
  price_myr?: number;
  price_text?: string;
  source_name?: string;
  source_url?: string;
}

export interface ProcessFlowNode {
  id: string;            // unique tag, e.g. "T-101", "P-101", "FT-101"
  label: string;         // human-readable, e.g. "Feed Tank"
  type: 'vessel' | 'pump' | 'valve' | 'instrument' | 'equipment' | 'fitting' | 'other';
}

export interface ProcessFlowEdge {
  from: string;          // node id
  to: string;            // node id
  label?: string;        // optional pipe size / fluid label, e.g. "DN100 SS316L"
}

export interface ProcessFlow {
  nodes: ProcessFlowNode[];
  edges: ProcessFlowEdge[];
}

export interface FluidSystemRecommendation {
  summary: string;
  system_type: string;
  design_basis: string;
  overall_confidence?: number;    // 0–100: overall recommendation confidence
  process_parameters: ProcessParameters;
  engineering_calculations?: EngineeringCalculations;
  process_flow?: ProcessFlow;
  components: SystemComponent[];
  piping: PipingSpec;
  instrumentation: Instrument[];
  risk_assessment: {
    overall_risk_level: 'low' | 'medium' | 'high' | 'critical';
    hazop_summary: string;
    risks: Risk[];
  };
  maintenance_schedule: MaintenanceSchedule[];
  compliance_standards: ComplianceStandard[];
  cost_estimate: CostEstimate;
  lead_time_weeks: number;
  recommended_vendors: Vendor[];
  engineering_notes: string;
}

export interface Project {
  id: string;
  userId: string;
  projectName: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'complete' | 'error';
  input: ProjectInput;
  recommendation: FluidSystemRecommendation | null;
}
