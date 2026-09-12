import { describe, it, expect } from "vitest";
import { baselineFromTaxonomy, priceLineItem, totals, proposalMarkdown } from "@/lib/domain/estimating";
import { matchAssemblyType } from "@/lib/domain/assemblies";

describe("assemblies", () => {
  it("matches free text to taxonomy keys", () => {
    expect(matchAssemblyType("gut the master bath")).toBe("bathroom remodel");
    expect(matchAssemblyType("crown molding in the living room")).toBe("trim carpentry");
    expect(matchAssemblyType("mudroom built-ins")).toBe("built-ins");
    expect(matchAssemblyType("deck")).toBeNull();
  });
});

describe("estimating", () => {
  it("prices a line item with quantity and rate", () => {
    const li = priceLineItem({ name: "Crown", laborHours: 2, materialCost: 50, quantity: 3 }, 85);
    expect(li.laborHours).toBe(6);
    expect(li.laborCost).toBe(510);
    expect(li.materialCost).toBe(150);
    expect(li.total).toBe(660);
  });
  it("applies overhead to the subtotal", () => {
    const items = [priceLineItem({ name: "A", laborHours: 10, materialCost: 100 }, 100)];
    const t = totals(items, 20);
    expect(t.subtotal).toBe(1100);
    expect(t.overhead).toBe(220);
    expect(t.total).toBe(1320);
  });
  it("builds a baseline kitchen from the taxonomy", () => {
    const b = baselineFromTaxonomy("kitchen remodel");
    expect(b.matchedType).toBe("kitchen remodel");
    expect(b.items.length).toBe(10);
    expect(b.totals.laborHours).toBe(78);
    expect(b.totals.total).toBeGreaterThan(20000);
  });
  it("renders a proposal with totals", () => {
    const b = baselineFromTaxonomy("trim carpentry");
    const md = proposalMarkdown({ company: "WCC", client: "Jane", projectType: "Trim", items: b.items, totals: b.totals, laborRate: 85, assumptions: ["Paint-grade poplar"] });
    expect(md).toContain("| **Total** |");
    expect(md).toContain("Paint-grade poplar");
  });
});
