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
  // MYR fields (new)
  unit_cost_myr?: number;
  total_cost_myr?: number;
  // USD fields (legacy fallback)
  unit_cost_usd?: number;
  total_cost_usd?: number;
  notes: string;
  alternatives?: ComponentAlternative[];
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
}

export interface LivePriceResult {
  componentId: string;
  found: boolean;
  price_myr?: number;
  price_text?: string;
  source_name?: string;
  source_url?: string;
}

export interface FluidSystemRecommendation {
  summary: string;
  system_type: string;
  design_basis: string;
  process_parameters: ProcessParameters;
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
