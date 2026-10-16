"use client";

import { useState } from "react";
import { db } from "@/lib/localDb";
import { useDraft } from "@/lib/useDraft";
import type { Doctor } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";
import DraftNotice from "./DraftNotice";

export default function DoctorForm({
  doctor,
  onClose,
  onSaved,
}: {
  doctor?: Doctor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const draft = useDraft(`doctor:${doctor?.id ?? "new"}`, {
    name: doctor?.name ?? "",
    phone: doctor?.phone ?? "",
    specialty: doctor?.specialty ?? "",
  });
  const { value: form, setValue: setForm } = draft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      specialty: form.specialty.trim() || null,
    };
    const { error } = doctor
      ? await db.from("doctors").update(payload).eq("id", doctor.id)
      : await db.from("doctors").insert(payload);
    setBusy(false);
    if (error) return setError(error.message);
    draft.clear();
    onSaved();
  }

  return (
    <Modal title={doctor ? "ექიმის რედაქტირება" : "ახალი ექიმი"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <DraftNotice restored={draft.restored} onReset={draft.reset} />
        <div>
          <label className="label">სახელი, გვარი *</label>
          <input required className="input" value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label className="label">ტელეფონი</label>
          <input type="tel" className="input" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="label">სპეციალობა</label>
          <input
            className="input"
            value={form.specialty}
            onChange={set("specialty")}
            placeholder="მაგ. თერაპევტი, ორთოდონტი, ქირურგი"
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
