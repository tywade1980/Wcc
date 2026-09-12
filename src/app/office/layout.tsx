import Link from "next/link";
import { env } from "@/lib/env";
import { db, companyId, type Approval } from "@/lib/db";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/office", label: "Today", icon: "☀️" },
  { href: "/office/inbox", label: "Inbox", icon: "📞" },
  { href: "/office/leads", label: "Leads", icon: "🎯" },
  { href: "/office/agents", label: "Staff", icon: "🧑‍💼" },
  { href: "/office/deliverables", label: "Work", icon: "📐" },
];

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const cid = await companyId();
  const pending = await db.count("approvals", { company_id: cid, status: "pending" } as Partial<Approval>);
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col">
      <header className="sticky top-0 z-20 bg-stone-900 text-stone-50 px-4 py-3 flex items-center justify-between shadow">
        <Link href="/office" className="font-semibold tracking-tight">{env.companyName} <span className="text-stone-400 font-normal">· Office</span></Link>
        <nav className="hidden sm:flex gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded hover:bg-stone-700 text-sm">{n.label}</Link>
          ))}
          <Link href="/office/settings" className="px-3 py-1.5 rounded hover:bg-stone-700 text-sm">Settings</Link>
        </nav>
        {pending > 0 && <Link href="/office#approvals" className="text-xs bg-amber-400 text-stone-900 rounded-full px-2 py-1 font-semibold">{pending} to approve</Link>}
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 pb-24 sm:pb-8">{children}</main>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-stone-900 text-stone-200 flex justify-around py-2 border-t border-stone-700" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="flex flex-col items-center text-[11px] gap-0.5 px-2">
            <span className="text-lg leading-none">{n.icon}</span>{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
