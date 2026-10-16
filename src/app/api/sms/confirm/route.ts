// SMS is turned off in the demo version.

// import { normalizePhone, sendSms, SmsError, userClient, visitMessage, VISIT_SMS_SELECT, type VisitForSms } from "@/lib/sms";
// 
// // Sends the "your visit is booked" SMS right after an appointment is created.
// export async function POST(request: Request) {
//   const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
//   if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
// 
//   const { appointmentId } = await request.json().catch(() => ({}));
//   if (!appointmentId) return Response.json({ error: "appointmentId აკლია" }, { status: 400 });
// 
//   const db = userClient(token);
//   const { data: auth, error: authError } = await db.auth.getUser(token);
//   if (authError || !auth.user) {
//     return Response.json({ error: `ავტორიზაცია ვერ დადასტურდა: ${authError?.message ?? ""}` }, { status: 401 });
//   }
//   const { data, error } = await db
//     .from("appointments")
//     .select(VISIT_SMS_SELECT)
//     .eq("id", appointmentId)
//     .maybeSingle();
//   if (error || !data) {
//     return Response.json(
//       { error: `ვიზიტი ვერ მოიძებნა (${error?.message ?? `id ${appointmentId}`})` },
//       { status: 404 },
//     );
//   }
// 
//   const visit = data as unknown as VisitForSms;
//   const to = normalizePhone(visit.patients?.phone);
//   if (!to) return Response.json({ error: "პაციენტს მობილურის ნომერი არ აქვს" }, { status: 422 });
// 
//   // Give the booking a moment to settle before notifying the patient.
//   await new Promise((resolve) => setTimeout(resolve, 10_000));
// 
//   let sms;
//   try {
//     sms = await sendSms(to, visitMessage(visit), `confirm-${visit.id}-${visit.date}-${visit.time}`);
//   } catch (e) {
//     const sms = e instanceof SmsError ? e.log : undefined;
//     return Response.json({ error: (e as Error).message, sms }, { status: 502 });
//   }
//   await db.from("appointments").update({ sms_confirm_sent_at: new Date().toISOString() }).eq("id", visit.id);
//   return Response.json({ ok: true, sms });
// }

export async function POST() {
  return Response.json({ error: "SMS გამორთულია დემო ვერსიაში" }, { status: 503 });
}
