// SMS reminders are turned off in the demo version.

// import { adminClient, normalizePhone, sendSms, visitMessage, VISIT_SMS_SELECT, type VisitForSms } from "@/lib/sms";
// 
// // Runs once a day (see vercel.json) and reminds patients about tomorrow's visits.
// export async function GET(request: Request) {
//   const secret = process.env.CRON_SECRET;
//   if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
//     return Response.json({ error: "Unauthorized" }, { status: 401 });
//   }
// 
//   // "Tomorrow" in Georgian time, regardless of the server's timezone.
//   const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
//     timeZone: "Asia/Tbilisi",
//   });
// 
//   const db = adminClient();
//   const { data, error } = await db
//     .from("appointments")
//     .select(VISIT_SMS_SELECT)
//     .eq("date", tomorrow)
//     .is("sms_reminder_sent_at", null);
//   if (error) return Response.json({ error: error.message }, { status: 500 });
// 
//   const result = { date: tomorrow, sent: 0, skipped: 0, failed: [] as string[] };
//   for (const visit of (data ?? []) as unknown as VisitForSms[]) {
//     const to = normalizePhone(visit.patients?.phone);
//     if (!to) {
//       result.skipped++;
//       continue;
//     }
//     try {
//       await sendSms(to, visitMessage(visit), `reminder-${visit.id}-${visit.date}-${visit.time}`);
//       await db
//         .from("appointments")
//         .update({ sms_reminder_sent_at: new Date().toISOString() })
//         .eq("id", visit.id);
//       result.sent++;
//     } catch (e) {
//       result.failed.push(`${visit.id}: ${(e as Error).message}`);
//     }
//   }
//   return Response.json(result);
// }

export async function GET() {
  return Response.json({ error: "SMS გამორთულია დემო ვერსიაში" }, { status: 503 });
}
