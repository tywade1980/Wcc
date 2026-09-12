import { notFound } from "next/navigation";
import { db, type Deliverable } from "@/lib/db";
import { DeliverableEditor } from "@/components/office/DeliverableEditor";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";

export default async function DeliverablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await db.get<Deliverable>("deliverables", id);
  if (!d) notFound();
  return <DeliverableEditor deliverable={d} shareUrl={`${env.baseUrl}/portal/${d.share_token}`} />;
}
