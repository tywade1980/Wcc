/** Create a Zoom consult for an appointment (office action). */
import { attachZoomToAppointment } from "@/lib/integrations/zoom";
import { requireOffice } from "@/lib/office-auth";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const denied = await requireOffice(req);
  if (denied) return denied;
  const { appointment_id } = (await req.json()) as { appointment_id: string };
  try {
    const appt = await attachZoomToAppointment(appointment_id);
    return Response.json({ ok: true, join_url: appt.zoom_join_url, meeting_id: appt.zoom_meeting_id });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
