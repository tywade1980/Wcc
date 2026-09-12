/** Edit/save a deliverable (new version), change status, or record a client decision via share token. */
import { db, type Deliverable } from "@/lib/db";
import { requireOffice } from "@/lib/office-auth";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await db.get<Deliverable>("deliverables", id);
  return d ? Response.json(d) : Response.json({ error: "not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { content?: string; title?: string; status?: string; data?: Record<string, unknown>; client_decision?: "approved" | "rejected"; share_token?: string };
  const d = await db.get<Deliverable>("deliverables", id);
  if (!d) return Response.json({ error: "not found" }, { status: 404 });

  // Client decision path: authenticated by share token, no office session needed.
  if (body.client_decision) {
    if (!body.share_token || body.share_token !== d.share_token) return Response.json({ error: "forbidden" }, { status: 403 });
    const u = await db.update<Deliverable>("deliverables", id, { client_decision: body.client_decision, status: body.client_decision, client_decided_at: new Date().toISOString() } as Partial<Deliverable>);
    return Response.json(u);
  }
  const denied = await requireOffice(req);
  if (denied) return denied;
  const patch: Partial<Deliverable> = {};
  if (body.title) patch.title = body.title;
  if (body.status) patch.status = body.status;
  if (body.data) patch.data = body.data;
  if (typeof body.content === "string" && body.content !== d.content) {
    await db.insert("deliverable_versions", { deliverable_id: id, version: d.version, content: d.content, data: d.data, edited_by: "tyler" } as never);
    patch.content = body.content;
    patch.version = d.version + 1;
  }
  return Response.json(await db.update<Deliverable>("deliverables", id, patch));
}
