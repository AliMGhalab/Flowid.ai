/**
 * Canonical fluid display names used across dashboard, project page, and exports.
 * Keep in sync with FLUID_LABELS in api/generate/route.ts.
 */
export const FLUID_LABELS: Record<string, string> = {
  water_utility:       'Utility Water',
  cooling_water:       'Cooling Water',
  demineralised_water: 'Demineralised Water',
  ultrapure_water:     'Ultrapure / Deionised Water (UPW)',
  purified_water:      'Purified Water (Pharma)',
  wfi:                 'Water for Injection (WFI)',
  seawater:            'Seawater / Brackish Water',
  chilled_water:       'Chilled Water (HVAC)',
  steam_lp:            'Low-Pressure Steam (< 10 bar)',
  steam_hp:            'High-Pressure Steam (≥ 10 bar)',
  crude_oil:           'Crude Oil',
  natural_gas:         'Natural Gas / Process Gas',
  lng:                 'LNG (Liquefied Natural Gas)',
  fuel_oil:            'Fuel Oil (Diesel / HFO)',
  hydraulic_oil:       'Hydraulic Oil',
  glycol:              'Glycol Solution (MEG / DEG / TEG)',
  cpo:                 'Crude Palm Oil (CPO)',
  pko:                 'Palm Kernel Oil (PKO)',
  rbdpo:               'RBD Palm Oil / Olein / Stearin',
  palm_fatty_acid:     'Palm Fatty Acid Distillate (PFAD)',
  compressed_air:      'Compressed Air',
  nitrogen:            'Nitrogen (N₂)',
  co2:                 'Carbon Dioxide (CO₂)',
  ammonia_gas:         'Ammonia Gas (NH₃)',
  latex:               'Natural Rubber Latex',
  ammonia_latex:       'Ammonia Solution (Latex Preservation)',
  formic_acid:         'Formic / Acetic Acid (Coagulant)',
  refrigerant_hfc:     'HFC Refrigerant (R134a / R410A)',
  refrigerant_co2:     'CO₂ Refrigerant (R744)',
  refrigerant_nh3:     'Ammonia Refrigerant (R717)',
  slurry:              'Slurry / Abrasive Fluid',
  palm_effluent:       'Palm Oil Mill Effluent (POME)',
  wastewater:          'Industrial Wastewater / Effluent',
  chemical_acid:       'Chemical — Acid',
  chemical_alkali:     'Chemical — Alkali / Caustic',
  chemical_solvent:    'Chemical — Solvent',
  chemical_other:      'Chemical (Specified)',
  other:               'Other Fluid (Specified)',
};

const NEEDS_CUSTOM = new Set([
  'chemical_acid', 'chemical_alkali', 'chemical_solvent', 'chemical_other', 'other',
]);

/**
 * Returns the human-readable fluid name for display in UI and exports.
 * Falls back to prettifying the raw value if the label is not found.
 */
export function getFluidLabel(fluidType: string, customFluidType?: string): string {
  if (NEEDS_CUSTOM.has(fluidType)) {
    return customFluidType?.trim() || FLUID_LABELS[fluidType] || fluidType;
  }
  return FLUID_LABELS[fluidType] ?? fluidType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
