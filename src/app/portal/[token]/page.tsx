import { db, type Deliverable } from "@/lib/db";
import { RenderContent } from "@/components/office/RenderContent";
import { ClientDecision } from "@/components/office/ClientDecision";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";

export default async function Portal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const d = await db.findOne<Deliverable>("deliverables", { share_token: token });
  if (!d || !["shared", "approved", "rejected"].includes(d.status)) return <div className="p-8 text-center text-stone-600">This link isn&apos;t active. Please contact {env.companyName}.</div>;
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-stone-900 text-white px-4 py-3 font-semibold">{env.companyName}</header>
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">{d.title}</h1>
        <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto"><RenderContent format={d.format} content={d.content} /></div>
        <ClientDecision id={d.id} token={token} decision={d.client_decision ?? null} />
        <p className="text-xs text-stone-500">Questions? Call or text {env.ownerMobile || "the office"}.</p>
      </main>
    </div>
  );
}
