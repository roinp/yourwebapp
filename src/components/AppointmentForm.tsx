"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/localDb";
import { fullName, todayISO } from "@/lib/format";
import { useDoctors } from "@/lib/useDoctors";
import { useDraft } from "@/lib/useDraft";
import type { Appointment, Patient } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";
import DraftNotice from "./DraftNotice";
import TimeSlotPicker from "./TimeSlotPicker";
import PatientForm from "./PatientForm";

type PatientOption = Pick<Patient, "id" | "first_name" | "last_name" | "phone" | "personal_id">;

export default function AppointmentForm({
  appointment,
  defaultDate,
  defaultTime,
  defaultPatientId,
  onClose,
  onSaved,
}: {
  appointment?: Appointment | null;
  defaultDate?: string;
  defaultTime?: string;
  defaultPatientId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const doctors = useDoctors();
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientsLoaded, setPatientsLoaded] = useState(false);
  const [filter, setFilter] = useState("");
  const draft = useDraft(
    appointment ? `appointment:${appointment.id}` : `appointment:new:${defaultPatientId ?? ""}`,
    {
      patient_id: appointment?.patient_id ?? defaultPatientId ?? "",
      doctor_id: appointment?.doctor_id ?? "",
      date: appointment?.date ?? defaultDate ?? todayISO(),
      time: appointment?.time?.slice(0, 5) ?? defaultTime ?? "10:00",
      reason: appointment?.reason ?? "",
      notes: appointment?.notes ?? "",
    },
  );
  const { value: form, setValue: setForm } = draft;
  const [timeOpen, setTimeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db
      .from("patients")
      .select("id, first_name, last_name, phone, personal_id")
      .order("last_name")
      .then(({ data }) => {
        setPatients(data ?? []);
        setPatientsLoaded(true);
      });
  }, []);

  // Other appointments on the chosen day, used to mark taken time slots.
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [dayBlocked, setDayBlocked] = useState<string[]>([]);
  useEffect(() => {
    if (!form.date) return;
    db
      .from("appointments")
      .select("id, time, doctor_id, patients(first_name, last_name)")
      .eq("date", form.date)
      .then(({ data }) => setDayAppointments((data as unknown as Appointment[]) ?? []));
    db
      .from("blocked_slots")
      .select("time")
      .eq("date", form.date)
      .then(({ data }) => setDayBlocked((data ?? []).map((b) => b.time.slice(0, 5))));
  }, [form.date]);

  const takenSlots: Record<string, string> = {};
  for (const t of dayBlocked) {
    // An existing visit may stay at its own time even if that time was blocked later.
    if (appointment && appointment.date === form.date && appointment.time.slice(0, 5) === t) continue;
    takenSlots[t] = "დაბლოკილია";
  }
  for (const a of dayAppointments) {
    if (a.id === appointment?.id) continue;
    if (form.doctor_id && a.doctor_id !== form.doctor_id) continue;
    takenSlots[a.time.slice(0, 5)] = fullName(a.patients);
  }
  const selectedTaken = takenSlots[form.time];

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  function matchPatients(text: string) {
    const q = text.trim().toLowerCase();
    if (!q) return patients;
    const digits = q.replace(/\s/g, "");
    return patients.filter(
      (p) =>
        fullName(p).toLowerCase().includes(q) ||
        `${p.last_name} ${p.first_name}`.toLowerCase().includes(q) ||
        (p.phone ?? "").replace(/\s/g, "").includes(digits) ||
        (p.personal_id ?? "").includes(digits),
    );
  }

  const matches = matchPatients(filter);
  const selectedPatient = patients.find((p) => p.id === form.patient_id);
  // Keep the chosen patient in the list even if it no longer matches the search.
  const visiblePatients =
    selectedPatient && !matches.includes(selectedPatient) ? [selectedPatient, ...matches] : matches;

  // Typing a name or phone automatically picks the first matching patient.
  function handleFilterChange(text: string) {
    setFilter(text);
    if (!text.trim()) return;
    setForm({ ...form, patient_id: matchPatients(text)[0]?.id ?? "" });
  }

  // When a search finds nobody, offer to add the patient once typing pauses.
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null);
  const [dismissedQuery, setDismissedQuery] = useState("");
  const [addingPatient, setAddingPatient] = useState(false);
  const searchText = filter.trim();
  const nothingFound = patientsLoaded && searchText.length >= 3 && matches.length === 0;

  useEffect(() => {
    if (!nothingFound || searchText === dismissedQuery) return;
    const timer = setTimeout(() => setNotFoundQuery(searchText), 1000);
    return () => clearTimeout(timer);
  }, [nothingFound, searchText, dismissedQuery]);

  function dismissNotFound() {
    setDismissedQuery(notFoundQuery ?? "");
    setNotFoundQuery(null);
  }

  /** Turn the search text into starting values for a new patient. */
  function prefillFromSearch(text: string) {
    // 11 digits is a Georgian personal ID; other numbers are treated as a phone.
    if (/^\d{11}$/.test(text.replace(/\s/g, ""))) return { personal_id: text.replace(/\s/g, "") };
    if (/^[\d\s+()-]+$/.test(text)) return { phone: text };
    const [first_name, ...rest] = text.split(/\s+/);
    return { first_name, last_name: rest.join(" ") };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_id) {
      if (searchText && matches.length === 0) return setNotFoundQuery(searchText);
      return setError("აირჩიეთ პაციენტი");
    }
    if (selectedTaken) return setError(`${form.time} დაკავებულია (${selectedTaken}). აირჩიეთ სხვა დრო.`);
    setBusy(true);
    setError(null);
    const payload = {
      patient_id: form.patient_id,
      doctor_id: form.doctor_id || null,
      date: form.date,
      time: form.time,
      reason: form.reason.trim() || null,
      notes: form.notes.trim() || null,
    };
    // A moved visit needs a fresh day-before reminder.
    const moved =
      appointment && (appointment.date !== form.date || appointment.time.slice(0, 5) !== form.time);
    const { error } = appointment
      ? await db
          .from("appointments")
          .update(moved ? { ...payload, sms_reminder_sent_at: null } : payload)
          .eq("id", appointment.id)
          .select("id")
          .single()
      : await db.from("appointments").insert(payload).select("id").single();
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    // SMS is turned off in the demo version.
    // if (!appointment || moved) {
    //   // The server waits 10 seconds before sending, so don't keep the form open for it.
    //   sendBookingSms(saved.id).then((smsError) => {
    //     if (smsError) window.alert(`ვიზიტი შენახულია, მაგრამ SMS ვერ გაიგზავნა:\n${smsError}`);
    //   });
    // }
    setBusy(false);
    draft.clear();
    onSaved();
  }

  // /** Returns an error message, or null when the SMS was sent. */
  // async function sendBookingSms(appointmentId: string) {
  //   const { data } = await supabase.auth.getSession();
  //   try {
  //     const res = await fetch("/api/sms/confirm", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${data.session?.access_token ?? ""}`,
  //       },
  //       body: JSON.stringify({ appointmentId }),
  //     });
  //     const body = await res.json().catch(() => null);
  //     if (body?.sms) {
  //       console.log("[SMS] request body:", body.sms.request);
  //       console.log(`[SMS] response ${body.sms.status}:`, body.sms.response);
  //     } else {
  //       console.log(`[SMS] ${res.status}:`, body);
  //     }
  //     if (res.ok) return null;
  //     return body?.error ?? `შეცდომა ${res.status}`;
  //   } catch {
  //     return "სერვერთან კავშირი ვერ დამყარდა";
  //   }
  // }

  return (
    <Modal title={appointment ? "ვიზიტის რედაქტირება" : "ვიზიტის დაჯავშნა"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <DraftNotice restored={draft.restored} onReset={draft.reset} />
        <div>
          <label className="label">პაციენტი *</label>
          {!defaultPatientId && (
            <>
              <input
                className="input"
                placeholder="🔍 სახელი, ტელეფონი ან პირადი ნომერი..."
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value)}
              />
              <p className="mb-2 mt-1 min-h-4 px-1 text-xs text-slate-500">
                {filter.trim()
                  ? matches.length === 0
                    ? "პაციენტი ვერ მოიძებნა"
                    : matches.length === 1
                      ? "✓ მოიძებნა 1 პაციენტი"
                      : `მოიძებნა ${matches.length}. არჩეულია პირველი, საჭიროების შემთხვევაში შეცვალეთ ქვემოთ`
                  : ""}
              </p>
            </>
          )}
          <select
            required
            className={`input ${form.patient_id ? "border-emerald-400 bg-emerald-50 font-medium" : ""}`}
            value={form.patient_id}
            onChange={set("patient_id")}
            disabled={Boolean(defaultPatientId)}
          >
            <option value="">— აირჩიეთ პაციენტი —</option>
            {visiblePatients.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
                {p.phone ? ` · ${p.phone}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="label">ექიმი</label>
            <select className="input" value={form.doctor_id} onChange={set("doctor_id")}>
              <option value="">— აირჩიეთ —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.specialty ? ` (${d.specialty})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">თარიღი *</label>
            <input type="date" required className="input" value={form.date} onChange={set("date")} />
          </div>
          <div>
            <label className="label">დრო *</label>
            <button
              type="button"
              onClick={() => setTimeOpen(!timeOpen)}
              className={`input flex items-center justify-between tabular-nums ${
                selectedTaken
                  ? "border-red-400 text-red-600 ring-2 ring-red-100"
                  : timeOpen
                    ? "border-teal-500 ring-2 ring-teal-100"
                    : ""
              }`}
            >
              <span>🕐 {form.time}</span>
              <span className={`text-xs text-slate-400 transition ${timeOpen ? "rotate-180" : ""}`}>▼</span>
            </button>
          </div>
          {timeOpen && (
            <div className="sm:col-span-3">
              <TimeSlotPicker
                value={form.time}
                busy={takenSlots}
                onChange={(time) => {
                  setForm({ ...form, time });
                  setTimeOpen(false);
                }}
              />
            </div>
          )}
        </div>
        <div>
          <label className="label">მიზეზი</label>
          <input
            className="input"
            value={form.reason}
            onChange={set("reason")}
            placeholder="მაგ. კონსულტაცია, ტკივილი, წმენდა"
          />
        </div>
        <div>
          <label className="label">შენიშვნები</label>
          <textarea rows={2} className="input" value={form.notes} onChange={set("notes")} />
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => { draft.clear(); onClose(); }}>
            გაუქმება
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "ინახება..." : "შენახვა"}
          </button>
        </div>
      </form>

      {notFoundQuery && !addingPatient && (
        <Modal title="პაციენტი ვერ მოიძებნა" onClose={dismissNotFound}>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
              🔍
            </div>
            <p className="mt-4 text-slate-700">
              „<b>{notFoundQuery}</b>“ პაციენტების სიაში არ არის.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              ვიზიტის დასაჯავშნად საჭიროა, პაციენტი ჯერ დაემატოს სიაში.
            </p>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={dismissNotFound}>
              დახურვა
            </button>
            <button type="button" className="btn-primary" onClick={() => setAddingPatient(true)}>
              + პაციენტის დამატება
            </button>
          </div>
        </Modal>
      )}

      {addingPatient && notFoundQuery && (
        <PatientForm
          prefill={prefillFromSearch(notFoundQuery)}
          onClose={() => setAddingPatient(false)}
          onSaved={(p) => {
            setPatients((list) => [...list, p]);
            setForm({ ...form, patient_id: p.id });
            setFilter(fullName(p));
            setAddingPatient(false);
            setNotFoundQuery(null);
            setError(null);
          }}
        />
      )}
    </Modal>
  );
}
