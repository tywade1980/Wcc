/**
 * Home assembly taxonomy — phase/task/labor-hour/material baselines for the
 * work Wade Custom Carpentry actually does. Ported from the WCC_Pro agent in
 * tywade1980/unified-agentic-ai-foundation (multi_agent_orchestrator.py).
 * The Estimator uses these as the starting skeleton, then adjusts with
 * RSMeans-style reasoning, the catalogue, and Tyler's actuals.
 */
export interface AssemblyTask {
  phase: string;
  task: string;
  laborHrs: number;
  materialEst: number;
}

export const DEFAULT_LABOR_RATE = 85; // Columbus, OH skilled finish carpentry $/hr
export const DEFAULT_OVERHEAD_PCT = 20;

export const ASSEMBLY_TAXONOMY: Record<string, AssemblyTask[]> = {
  "bathroom remodel": [
    { phase: "Demo", task: "Remove existing fixtures, tile, and drywall", laborHrs: 8, materialEst: 0 },
    { phase: "Structural", task: "Backer board and waterproofing membrane", laborHrs: 4, materialEst: 350 },
    { phase: "Plumbing", task: "Rough-in plumbing (drain, supply lines)", laborHrs: 6, materialEst: 600 },
    { phase: "Electrical", task: "GFCI outlets, exhaust fan, lighting rough-in", laborHrs: 4, materialEst: 400 },
    { phase: "Tile", task: "Floor tile installation (porcelain/stone)", laborHrs: 12, materialEst: 1200 },
    { phase: "Tile", task: "Shower wall tile installation", laborHrs: 16, materialEst: 1800 },
    { phase: "Fixtures", task: "Vanity, toilet, and shower valve installation", laborHrs: 8, materialEst: 2500 },
    { phase: "Trim", task: "Door casing, baseboard, and finish trim", laborHrs: 6, materialEst: 400 },
    { phase: "Paint", task: "Primer and two-coat finish paint", laborHrs: 6, materialEst: 300 },
  ],
  "kitchen remodel": [
    { phase: "Demo", task: "Remove cabinets, countertops, and appliances", laborHrs: 10, materialEst: 0 },
    { phase: "Structural", task: "Wall framing and drywall repairs", laborHrs: 8, materialEst: 500 },
    { phase: "Plumbing", task: "Sink rough-in and supply lines", laborHrs: 4, materialEst: 400 },
    { phase: "Electrical", task: "Outlet circuits, under-cabinet lighting", laborHrs: 8, materialEst: 600 },
    { phase: "Cabinets", task: "Custom cabinet installation", laborHrs: 16, materialEst: 8000 },
    { phase: "Countertops", task: "Countertop template, fabrication, and install", laborHrs: 4, materialEst: 3500 },
    { phase: "Backsplash", task: "Tile backsplash installation", laborHrs: 8, materialEst: 800 },
    { phase: "Appliances", task: "Appliance installation and hook-up", laborHrs: 4, materialEst: 5000 },
    { phase: "Trim", task: "Crown molding, baseboard, and finish trim", laborHrs: 8, materialEst: 600 },
    { phase: "Paint", task: "Primer and two-coat finish paint", laborHrs: 8, materialEst: 400 },
  ],
  "trim carpentry": [
    { phase: "Prep", task: "Measure, layout, and material staging", laborHrs: 2, materialEst: 0 },
    { phase: "Baseboard", task: "Install baseboard (solid poplar/oak)", laborHrs: 4, materialEst: 300 },
    { phase: "Door Casing", task: "Install door casing (per opening)", laborHrs: 2, materialEst: 150 },
    { phase: "Crown", task: "Install crown molding", laborHrs: 6, materialEst: 500 },
    { phase: "Windows", task: "Window casing and stools", laborHrs: 3, materialEst: 200 },
    { phase: "Paint Prep", task: "Caulk, fill nail holes, sand", laborHrs: 3, materialEst: 50 },
  ],
  "built-ins": [
    { phase: "Design", task: "Field measure, shop drawing, client sign-off", laborHrs: 4, materialEst: 0 },
    { phase: "Shop", task: "Cabinet box and face-frame fabrication", laborHrs: 16, materialEst: 1200 },
    { phase: "Shop", task: "Doors, drawers, shelving, hardware", laborHrs: 10, materialEst: 900 },
    { phase: "Finish", task: "Sand, prime, paint or stain/clear", laborHrs: 8, materialEst: 250 },
    { phase: "Install", task: "Set, scribe, secure, trim-out", laborHrs: 8, materialEst: 150 },
  ],
  flooring: [
    { phase: "Demo", task: "Remove existing flooring and prep subfloor", laborHrs: 6, materialEst: 0 },
    { phase: "Subfloor", task: "Level and repair subfloor", laborHrs: 4, materialEst: 200 },
    { phase: "Underlayment", task: "Install underlayment/soundproofing", laborHrs: 3, materialEst: 400 },
    { phase: "Flooring", task: "Install hardwood/LVP/tile flooring", laborHrs: 12, materialEst: 2500 },
    { phase: "Transitions", task: "Install thresholds and transitions", laborHrs: 2, materialEst: 150 },
  ],
  addition: [
    { phase: "Foundation", task: "Concrete footings and foundation", laborHrs: 24, materialEst: 8000 },
    { phase: "Framing", task: "Wall and roof framing", laborHrs: 40, materialEst: 6000 },
    { phase: "Roofing", task: "Roof sheathing, felt, and shingles", laborHrs: 16, materialEst: 3500 },
    { phase: "Windows", task: "Window and exterior door installation", laborHrs: 8, materialEst: 4000 },
    { phase: "Insulation", task: "Wall and ceiling insulation", laborHrs: 8, materialEst: 1500 },
    { phase: "Drywall", task: "Hang, tape, mud, and sand drywall", laborHrs: 24, materialEst: 2000 },
    { phase: "Trim", task: "Interior trim carpentry", laborHrs: 16, materialEst: 1200 },
    { phase: "Paint", task: "Interior paint", laborHrs: 16, materialEst: 800 },
  ],
};

/** Match free text like "gut the master bath" to a taxonomy key. */
export function matchAssemblyType(projectType: string): string | null {
  const t = projectType.toLowerCase();
  const aliases: Record<string, string[]> = {
    "bathroom remodel": ["bath", "shower", "vanity"],
    "kitchen remodel": ["kitchen", "cabinet", "countertop"],
    "trim carpentry": ["trim", "crown", "baseboard", "casing", "molding", "moulding", "wainscot"],
    "built-ins": ["built-in", "built in", "bookcase", "bookshelf", "mudroom", "entertainment center", "closet"],
    flooring: ["floor", "hardwood", "lvp", "tile floor"],
    addition: ["addition", "add-on", "bump out", "sunroom"],
  };
  for (const [key, words] of Object.entries(aliases)) if (key === t || words.some((w) => t.includes(w))) return key;
  return null;
}
