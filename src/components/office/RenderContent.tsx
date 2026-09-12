/** Renders a deliverable by format. Markdown gets a small, safe renderer (tables, headings, lists, bold). */
export function RenderContent({ format, content }: { format: string; content: string }) {
  if (format === "svg") return <div className="[&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: sanitizeSvg(content) }} />;
  if (format === "html") return <iframe sandbox="" srcDoc={content} className="w-full min-h-[70vh] border-0" title="deliverable" />;
  if (format === "json") return <pre className="text-xs whitespace-pre-wrap">{pretty(content)}</pre>;
  return <div className="prose prose-stone max-w-none text-sm" dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />;
}

function pretty(s: string) { try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; } }

function sanitizeSvg(svg: string) {
  return svg.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "").replace(/javascript:/gi, "");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, "<code>$1</code>");

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*\|/.test(l) && /^\s*\|?\s*:?-+/.test(lines[i + 1] ?? "")) {
      const header = l.split("|").slice(1, -1).map((c) => `<th class="text-left border-b px-2 py-1">${inline(c.trim())}</th>`).join("");
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(`<tr>${lines[i].split("|").slice(1, -1).map((c) => `<td class="border-b px-2 py-1 align-top">${inline(c.trim())}</td>`).join("")}</tr>`); i++; }
      out.push(`<table class="w-full text-sm my-3"><thead><tr>${header}</tr></thead><tbody>${rows.join("")}</tbody></table>`);
      continue;
    }
    const h = l.match(/^(#{1,6})\s+(.*)/);
    if (h) { const n = h[1].length; out.push(`<h${n} class="font-semibold mt-4 mb-1 ${n === 1 ? "text-xl" : n === 2 ? "text-lg" : "text-base"}">${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^\s*[-*]\s+/.test(l)) { const items: string[] = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`); i++; } out.push(`<ul class="list-disc pl-5 my-2">${items.join("")}</ul>`); continue; }
    if (/^\s*\d+\.\s+/.test(l)) { const items: string[] = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`); i++; } out.push(`<ol class="list-decimal pl-5 my-2">${items.join("")}</ol>`); continue; }
    if (/^\s*---+\s*$/.test(l)) { out.push('<hr class="my-3" />'); i++; continue; }
    if (l.trim() === "") { i++; continue; }
    out.push(`<p class="my-1">${inline(l)}</p>`);
    i++;
  }
  return out.join("\n");
}
