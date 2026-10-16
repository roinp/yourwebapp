"use client";

import { useState } from "react";
import Link from "next/link";
import { db } from "@/lib/localDb";
import { formatDate, formatTime, fullName } from "@/lib/format";
import type { Appointment } from "@/lib/types";
import Modal from "./Modal";
import AppointmentForm from "./AppointmentForm";
import ConfirmDialog from "./ConfirmDialog";

/** Details modal for an appointment, with edit and delete actions. */
export default function AppointmentDetails({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");

  if (mode === "edit") {
    return (
      <AppointmentForm
        appointment={appointment}
        onClose={() => setMode("view")}
        onSaved={() => {
          onChanged();
          onClose();
        }}
      />
    );
  }

  if (mode === "delete") {
    return (
      <ConfirmDialog
        message="ნამდვილად გსურთ ამ ვიზიტის წაშლა?"
        onClose={() => setMode("view")}
        onConfirm={async () => {
          await db.from("appointments").delete().eq("id", appointment.id);
          onChanged();
          onClose();
        }}
      />
    );
  }

  const rows: [string, React.ReactNode][] = [
    [
      "პაციენტი",
      <Link
        key="p"
        href={`/patients/${appointment.patient_id}`}
        className="font-medium text-teal-700 hover:underline"
      >
        {fullName(appointment.patients)}
      </Link>,
    ],
    ["ტელეფონი", appointment.patients?.phone ?? "—"],
    ["ექიმი", appointment.doctors?.name ?? "—"],
    ["თარიღი", formatDate(appointment.date)],
    ["დრო", formatTime(appointment.time)],
    ["მიზეზი", appointment.reason ?? "—"],
    ["შენიშვნები", appointment.notes ?? "—"],
  ];

  return (
    <Modal title="ვიზიტის დეტალები" onClose={onClose}>
      <dl className="divide-y divide-slate-100">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-2 py-2.5 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="col-span-2 whitespace-pre-wrap">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button className="btn-secondary text-red-600" onClick={() => setMode("delete")}>
          წაშლა
        </button>
        <button className="btn-primary" onClick={() => setMode("edit")}>
          რედაქტირება
        </button>
      </div>
    </Modal>
  );
}
