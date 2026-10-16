// SMS (beephub.ge) is turned off in the demo version.

// // Server-only helpers for sending visit SMS through beephub.ge (API v2).
// import { createClient } from "@supabase/supabase-js";
// 
// const API_URL = "https://sms-api.beephub.ge/v2/sms:send";
// export const CLINIC_ADDRESS = "ზვიად გამსახურდიას ქ. №49";
// 
// export type VisitForSms = {
//   id: string;
//   date: string;
//   time: string;
//   patients: { phone: string | null } | null;
//   doctors: { name: string } | null;
// };
// 
// export const VISIT_SMS_SELECT = "id, date, time, patients(phone), doctors(name)";
// 
// /** "2026-10-14", "14:30:00" → "14.10.2026 14:30" */
// function formatWhen(date: string, time: string) {
//   const [y, m, d] = date.split("-");
//   return `${d}.${m}.${y} ${time.slice(0, 5)}`;
// }
// 
// /** "ბერიძე" → "ბერიძესთან", "გელაშვილი" → "გელაშვილთან" (Georgian "with" case). */
// function withCase(name: string) {
//   const trimmed = name.trim();
//   if (trimmed.endsWith("ი")) return `${trimmed.slice(0, -1)}თან`;
//   if (/[აეოუ]$/.test(trimmed)) return `${trimmed}სთან`;
//   return `${trimmed}თან`;
// }
// 
// export function visitMessage(v: VisitForSms) {
//   const doctor = v.doctors?.name ? ` ექიმ ${withCase(v.doctors.name)}` : "";
//   return `მოგესალმებით! თქვენი ვიზიტი${doctor} ჩანიშნულია, ${formatWhen(v.date, v.time)}.\nმისამართი: ${CLINIC_ADDRESS}.`;
// }
// 
// /** Georgian mobile numbers only: returns 9 digits starting with 5, or null. */
// export function normalizePhone(phone: string | null | undefined) {
//   const digits = (phone ?? "").replace(/\D/g, "").replace(/^(00)?995/, "");
//   return /^5\d{8}$/.test(digits) ? `995${digits}` : null;
// }
// 
// /**
//  * Sends one SMS. `reference` is an idempotency key, so a retried request
//  * with the same reference is not delivered twice.
//  */
// export async function sendSms(to: string, text: string, reference: string) {
//   const apiKey = process.env.BEEPHUB_API_KEY;
//   const from = process.env.BEEPHUB_SENDER ?? "YOURWEBAPP";
//   if (!apiKey) throw new Error("BEEPHUB_API_KEY არ არის მითითებული");
// 
//   const request = { from, text, clientReference: reference, messages: [{ to }] };
//   console.log("[SMS] request body:", JSON.stringify(request, null, 2));
//   const res = await fetch(API_URL, {
//     method: "POST",
//     headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
//     body: JSON.stringify(request),
//   });
//   const body = await res.json().catch(() => null);
//   console.log(`[SMS] response ${res.status}:`, JSON.stringify(body, null, 2));
//   const log: SmsLog = { request, status: res.status, response: body };
//   const state = body?.messages?.[0]?.state ?? body?.state;
//   if (!res.ok || (state && state !== "ACCEPTED")) {
//     throw new SmsError(body?.detail ?? body?.title ?? `SMS შეცდომა (${res.status})`, log);
//   }
//   return log;
// }
// 
// export type SmsLog = { request: unknown; status: number; response: unknown };
// 
// export class SmsError extends Error {
//   constructor(
//     message: string,
//     public log: SmsLog,
//   ) {
//     super(message);
//   }
// }
// 
// /** Supabase client acting as the signed-in staff member (RLS applies). */
// export function userClient(accessToken: string) {
//   return createClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false } },
//   );
// }
// 
// /** Supabase client with full access, for the scheduled reminder job only. */
// export function adminClient() {
//   const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
//   if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY არ არის მითითებული");
//   return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
//     auth: { persistSession: false },
//   });
// }

export {};
