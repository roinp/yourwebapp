"use client";

import { useState } from "react";
import { db } from "@/lib/localDb";
import { useDraft } from "@/lib/useDraft";
import type { Patient } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";
import DraftNotice from "./DraftNotice";

export default function PatientForm({
  patient,
  prefill,
  onClose,
  onSaved,
}: {
  patient?: Patient | null;
  /** Values to start a new patient with, e.g. what was typed in a search box. */
  prefill?: { first_name?: string; last_name?: string; phone?: string; personal_id?: string };
  onClose: () => void;
  onSaved: (p: Patient) => void;
}) {
  const draft = useDraft(`patient:${patient?.id ?? (prefill ? "new:prefill" : "new")}`, {
    first_name: patient?.first_name ?? prefill?.first_name ?? "",
    last_name: patient?.last_name ?? prefill?.last_name ?? "",
    personal_id: patient?.personal_id ?? prefill?.personal_id ?? "",
    phone: patient?.phone ?? prefill?.phone ?? "",
    date_of_birth: patient?.date_of_birth ?? "",
    notes: patient?.notes ?? "",
  });
  const { value: form, setValue: setForm } = draft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Georgian personal IDs are 11 digits; only a hint, since foreigners may have other formats.
  const pid = form.personal_id.replace(/\s/g, "");
  const pidWarning =
    pid && !/^\d{11}$/.test(pid) ? `ქართული პირადი ნომერი 11 ციფრია (ახლა: ${pid.length})` : null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      personal_id: form.personal_id.replace(/\s/g, "") || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      notes: form.notes.trim() || null,
    };
    const query = patient
      ? db.from("patients").update(payload).eq("id", patient.id)
      : db.from("patients").insert(payload);
    const { data, error } = await query.select().single();
    setBusy(false);
    if (error) {
      return setError(
        error.code === "23505" ? "ამ პირადი ნომრით პაციენტი უკვე არსებობს" : error.message,
      );
    }
    draft.clear();
    onSaved(data as Patient);
  }

  return (
    <Modal title={patient ? "პაციენტის რედაქტირება" : "ახალი პაციენტი"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <DraftNotice restored={draft.restored} onReset={draft.reset} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">სახელი *</label>
            <input required className="input" value={form.first_name} onChange={set("first_name")} />
          </div>
          <div>
            <label className="label">გვარი *</label>
            <input required className="input" value={form.last_name} onChange={set("last_name")} />
          </div>
          <div>
            <label className="label">პირადი ნომერი</label>
            <input
              className="input tabular-nums"
              inputMode="numeric"
              value={form.personal_id}
              onChange={set("personal_id")}
              placeholder="11 ციფრი"
            />
            {pidWarning && <p className="mt-1 text-xs text-amber-600">{pidWarning}</p>}
          </div>
          <div>
            <label className="label">ტელეფონი</label>
            <input type="tel" className="input" value={form.phone} onChange={set("phone")} placeholder="5XX XX XX XX" />
          </div>
          <div>
            <label className="label">დაბადების თარიღი</label>
            <input type="date" className="input" value={form.date_of_birth} onChange={set("date_of_birth")} />
          </div>
        </div>
        <div>
          <label className="label">შენიშვნები</label>
          <textarea
            rows={3}
            className="input"
            value={form.notes}
            onChange={set("notes")}
            placeholder="ალერგიები, ქრონიკული დაავადებები..."
          />
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
    </Modal>
  );
}
