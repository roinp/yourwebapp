"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/localDb";
import { formatDate, formatTime, fullName, todayISO } from "@/lib/format";
import type { Appointment } from "@/lib/types";
import AppointmentForm from "@/components/AppointmentForm";
import AppointmentDetails from "@/components/AppointmentDetails";
import PatientForm from "@/components/PatientForm";

const APPT_SELECT = "*, patients(id, first_name, last_name, phone), doctors(id, name)";

export default function DashboardPage() {
  const [today, setToday] = useState<Appointment[]>([]);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [patientCount, setPatientCount] = useState<number | null>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [booking, setBooking] = useState(false);
  const [addingPatient, setAddingPatient] = useState(false);

  const load = useCallback(async () => {
    const t = todayISO();
    const [todayRes, upcomingRes, countRes] = await Promise.all([
      db.from("appointments").select(APPT_SELECT).eq("date", t).order("time"),
      db
        .from("appointments")
        .select(APPT_SELECT, { count: "exact" })
        .gt("date", t)
        .order("date")
        .order("time")
        .limit(100),
      db.from("patients").select("id", { count: "exact", head: true }),
    ]);
    setToday(todayRes.data ?? []);
    setUpcoming(upcomingRes.data ?? []);
    setUpcomingCount(upcomingRes.count ?? 0);
    setPatientCount(countRes.count ?? 0);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">მთავარი</h1>
          <p className="text-sm text-slate-500">{formatDate(todayISO())}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setAddingPatient(true)}>
            + პაციენტი
          </button>
          <button className="btn-primary" onClick={() => setBooking(true)}>
            + ვიზიტის დაჯავშნა
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="დღევანდელი ვიზიტები" value={today.length} color="bg-teal-50 text-teal-700" />
        <Stat label="სულ პაციენტები" value={patientCount ?? "…"} color="bg-sky-50 text-sky-700" />
        <Stat label="მომავალი ვიზიტები" value={upcomingCount} color="bg-amber-50 text-amber-700" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="დღევანდელი ვიზიტები" scroll>
          {today.length === 0 ? (
            <Empty text="დღეს ვიზიტები არ არის" />
          ) : (
            today.map((a) => (
              <ApptRow key={a.id} a={a} onClick={() => setSelected(a)} />
            ))
          )}
        </Section>

        <Section
          title="მომავალი ვიზიტები"
          scroll
          action={
            <Link href="/calendar" className="text-sm text-teal-700 hover:underline">
              კალენდარი →
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <Empty text="მომავალი ვიზიტები არ არის" />
          ) : (
            upcoming.map((a) => (
              <ApptRow key={a.id} a={a} showDate onClick={() => setSelected(a)} />
            ))
          )}
        </Section>
      </div>

      {selected && (
        <AppointmentDetails appointment={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
      {booking && (
        <AppointmentForm
          onClose={() => setBooking(false)}
          onSaved={() => {
            setBooking(false);
            load();
          }}
        />
      )}
      {addingPatient && (
        <PatientForm
          onClose={() => setAddingPatient(false)}
          onSaved={() => {
            setAddingPatient(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 inline-block rounded-lg px-3 py-1 text-3xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Section({
  title,
  action,
  scroll = false,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  /** Show about 7 rows, scroll the rest. */
  scroll?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      <div className={`divide-y divide-slate-100 ${scroll ? "max-h-[483px] overflow-y-auto" : ""}`}>{children}</div>
    </section>
  );
}

function ApptRow({ a, showDate, onClick }: { a: Appointment; showDate?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-slate-50">
      <div className="w-20 shrink-0">
        <p className="font-semibold text-teal-700">{formatTime(a.time)}</p>
        {showDate && <p className="text-xs text-slate-500">{formatDate(a.date)}</p>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{fullName(a.patients)}</p>
        <p className="truncate text-sm text-slate-500">
          {a.reason ?? "—"}
          {a.doctors ? ` · ${a.doctors.name}` : ""}
        </p>
      </div>
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-slate-400">{text}</p>;
}
