/**
 * Estimate math. Pure functions so the Estimator agent, the UI, and tests all
 * compute the same numbers. Calculation rules ported from
 * nextgenbuildpro CalculationEngineService + the WCC_Pro estimate tool.
 */
import { ASSEMBLY_TAXONOMY, DEFAULT_LABOR_RATE, DEFAULT_OVERHEAD_PCT, matchAssemblyType, type AssemblyTask } from "./assemblies";

export interface LineItemInput {
  phase?: string;
  name: string;
  description?: string;
  quantity?: number;
  unit?: string;
  laborHours?: number;
  materialCost?: number;
  equipmentCost?: number;
  subcontractorCost?: number;
  csiDivision?: string;
  rsmeansReference?: string;
}

export interface LineItem extends Required<Omit<LineItemInput, "description" | "csiDivision" | "rsmeansReference" | "phase">> {
  phase: string;
  description: string;
  csiDivision: string;
  rsmeansReference: string;
  laborCost: number;
  total: number;
}

export interface EstimateTotals {
  laborHours: number;
  laborTotal: number;
  materialTotal: number;
  equipmentTotal: number;
  subcontractorTotal: number;
  subtotal: number;
  overheadPct: number;
  overhead: number;
  total: number;
}

export function priceLineItem(input: LineItemInput, laborRate = DEFAULT_LABOR_RATE): LineItem {
  const quantity = input.quantity ?? 1;
  const laborHours = round2((input.laborHours ?? 0) * quantity);
  const laborCost = round2(laborHours * laborRate);
  const materialCost = round2((input.materialCost ?? 0) * quantity);
  const equipmentCost = round2((input.equipmentCost ?? 0) * quantity);
  const subcontractorCost = round2((input.subcontractorCost ?? 0) * quantity);
  return {
    phase: input.phase ?? "General",
    name: input.name,
    description: input.description ?? "",
    quantity,
    unit: input.unit ?? "ea",
    laborHours,
    laborCost,
    materialCost,
    equipmentCost,
    subcontractorCost,
    csiDivision: input.csiDivision ?? "",
    rsmeansReference: input.rsmeansReference ?? "",
    total: round2(laborCost + materialCost + equipmentCost + subcontractorCost),
  };
}

export function totals(items: LineItem[], overheadPct = DEFAULT_OVERHEAD_PCT): EstimateTotals {
  const sum = (k: keyof LineItem) => round2(items.reduce((a, i) => a + Number(i[k] ?? 0), 0));
  const laborTotal = sum("laborCost");
  const materialTotal = sum("materialCost");
  const equipmentTotal = sum("equipmentCost");
  const subcontractorTotal = sum("subcontractorCost");
  const subtotal = round2(laborTotal + materialTotal + equipmentTotal + subcontractorTotal);
  const overhead = round2(subtotal * (overheadPct / 100));
  return { laborHours: sum("laborHours"), laborTotal, materialTotal, equipmentTotal, subcontractorTotal, subtotal, overheadPct, overhead, total: round2(subtotal + overhead) };
}

/** Build a baseline estimate from the assembly taxonomy for a project type. */
export function baselineFromTaxonomy(projectType: string, laborRate = DEFAULT_LABOR_RATE, multiplier = 1) {
  const key = matchAssemblyType(projectType);
  const tasks: AssemblyTask[] = key ? ASSEMBLY_TAXONOMY[key] : [{ phase: "Custom", task: projectType, laborHrs: 0, materialEst: 0 }];
  const items = tasks.map((t) =>
    priceLineItem({ phase: t.phase, name: t.task, laborHours: t.laborHrs * multiplier, materialCost: t.materialEst * multiplier }, laborRate),
  );
  return { matchedType: key ?? projectType, items, totals: totals(items) };
}

export function proposalMarkdown(opts: { company: string; client: string; projectType: string; location?: string; items: LineItem[]; totals: EstimateTotals; laborRate: number; assumptions?: string[]; exclusions?: string[] }) {
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lines = [
    `# Project Proposal: ${opts.projectType}`,
    `## ${opts.company}`,
    `**Client:** ${opts.client}  `,
    opts.location ? `**Location:** ${opts.location}` : "",
    "",
    "---",
    "",
    "### Scope of Work",
    "",
    "| Phase | Task | Qty | Labor Hrs | Materials | Line Total |",
    "| :--- | :--- | ---: | ---: | ---: | ---: |",
    ...opts.items.map((i) => `| ${i.phase} | ${i.name} | ${i.quantity} ${i.unit} | ${i.laborHours} | ${money(i.materialCost)} | ${money(i.total)} |`),
    "",
    "### Cost Summary",
    "",
    "| Item | Amount |",
    "| :--- | ---: |",
    `| Labor (${opts.totals.laborHours} hrs @ ${money(opts.laborRate)}/hr) | ${money(opts.totals.laborTotal)} |`,
    `| Materials | ${money(opts.totals.materialTotal)} |`,
    opts.totals.equipmentTotal ? `| Equipment | ${money(opts.totals.equipmentTotal)} |` : "",
    opts.totals.subcontractorTotal ? `| Subcontractors | ${money(opts.totals.subcontractorTotal)} |` : "",
    `| Subtotal | ${money(opts.totals.subtotal)} |`,
    `| Overhead & Profit (${opts.totals.overheadPct}%) | ${money(opts.totals.overhead)} |`,
    `| **Total** | **${money(opts.totals.total)}** |`,
    "",
    opts.assumptions?.length ? ["### Assumptions", ...opts.assumptions.map((a) => `- ${a}`), ""].join("\n") : "",
    opts.exclusions?.length ? ["### Exclusions", ...opts.exclusions.map((a) => `- ${a}`), ""].join("\n") : "",
    "---",
    "*Preliminary estimate, valid 30 days. Final pricing subject to site verification.*",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
