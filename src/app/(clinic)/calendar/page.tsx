"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/localDb";
import { WEEKDAYS_SHORT, formatDate, formatTime, fullName, monthName, toISODate, todayISO } from "@/lib/format";
import type { Appointment, BlockedSlot } from "@/lib/types";
import AppointmentForm from "@/components/AppointmentForm";
import AppointmentDetails from "@/components/AppointmentDetails";
import DaySchedule from "@/components/DaySchedule";

/** 6x7 grid of dates for the month, weeks starting on Monday. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingTime, setBookingTime] = useState<string | undefined>();
  const [dayOpen, setDayOpen] = useState(false);

  const days = monthGrid(year, month);

  const load = useCallback(async () => {
    const grid = monthGrid(year, month);
    const rangeStart = toISODate(grid[0]);
    const rangeEnd = toISODate(grid[grid.length - 1]);
    const [{ data }, { data: blocked }] = await Promise.all([
      db
        .from("appointments")
        .select("*, patients(id, first_name, last_name, phone), doctors(id, name)")
        .gte("date", rangeStart)
        .lte("date", rangeEnd)
        .order("date")
        .order("time"),
      db.from("blocked_slots").select("*").gte("date", rangeStart).lte("date", rangeEnd),
    ]);
    setAppointments(data ?? []);
    setBlockedSlots(blocked ?? []);
  }, [year, month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const byDate = new Map<string, Appointment[]>();
  for (const a of appointments) {
    byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
  }
  const dayAppointments = byDate.get(selectedDate) ?? [];

  const blockedByDate = new Map<string, Set<string>>();
  for (const b of blockedSlots) {
    if (!blockedByDate.has(b.date)) blockedByDate.set(b.date, new Set());
    blockedByDate.get(b.date)!.add(formatTime(b.time));
  }
  const dayBlocked = blockedByDate.get(selectedDate) ?? new Set<string>();

  async function toggleBlock(time: string) {
    const { error } = dayBlocked.has(time)
      ? await db.from("blocked_slots").delete().eq("date", selectedDate).eq("time", time)
      : await db.from("blocked_slots").insert({ date: selectedDate, time });
    setBlockError(error?.message ?? null);
    load();
  }

  async function blockDay(times: string[]) {
    const { error } = await db
      .from("blocked_slots")
      .upsert(
        times.map((time) => ({ date: selectedDate, time })),
        { onConflict: "date,time", ignoreDuplicates: true },
      );
    setBlockError(error?.message ?? null);
    load();
  }

  async function unblockDay() {
    const { error } = await db.from("blocked_slots").delete().eq("date", selectedDate);
    setBlockError(error?.message ?? null);
    load();
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDate(todayISO());
  }

  const today = todayISO();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">კალენდარი</h1>
        <button className="btn-primary" onClick={() => setBooking(true)}>
          + ვიზიტის დაჯავშნა
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        {/* Month view */}
        <section className="card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button className="btn-secondary px-3" onClick={() => shiftMonth(-1)} aria-label="წინა თვე">
                ‹
              </button>
              <button className="btn-secondary px-3" onClick={() => shiftMonth(1)} aria-label="შემდეგი თვე">
                ›
              </button>
              <button className="btn-secondary" onClick={goToday}>
                დღეს
              </button>
            </div>
            <h2 className="text-lg font-semibold">
              {monthName(month)} {year}
            </h2>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm">
            {WEEKDAYS_SHORT.map((w, i) => (
              <div
                key={w}
                className={`py-2 text-center text-xs font-medium ${
                  i >= 5 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500"
                }`}
              >
                {w}
              </div>
            ))}
            {days.map((d) => {
              const iso = toISODate(d);
              const list = byDate.get(iso) ?? [];
              const inMonth = d.getMonth() === month;
              const isSelected = iso === selectedDate;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={iso}
                  onClick={() => {
                    setSelectedDate(iso);
                    setDayOpen(true);
                  }}
                  className={`min-h-20 cursor-pointer p-1 sm:min-h-28 sm:p-1.5 ${
                    isSelected
                      ? "bg-teal-50 ring-2 ring-inset ring-teal-500"
                      : isWeekend
                        ? "bg-red-50/60 hover:bg-red-50"
                        : "bg-white hover:bg-slate-50"
                  } ${inMonth ? (isWeekend ? "text-red-600" : "") : isWeekend ? "text-red-300" : "text-slate-300"}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        iso === today ? "bg-teal-600 font-semibold text-white" : isWeekend ? "font-semibold" : ""
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {blockedByDate.has(iso) && (
                      <span className="ml-auto mr-1 text-[10px] opacity-60" title="აქვს დაბლოკილი საათები">
                        🔒
                      </span>
                    )}
                    {list.length > 0 && (
                      <span className="rounded-full bg-teal-100 px-1.5 text-[10px] font-semibold text-teal-700 sm:hidden">
                        {list.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 hidden space-y-0.5 sm:block">
                    {list.slice(0, 3).map((a) => (
                      <button
                        key={a.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(a);
                        }}
                        className="block w-full truncate rounded bg-teal-100 px-1.5 py-0.5 text-left text-[11px] text-teal-800 hover:bg-teal-200"
                      >
                        {formatTime(a.time)} {a.patients?.last_name}
                      </button>
                    ))}
                    {list.length > 3 && <p className="px-1 text-[11px] text-slate-500">+{list.length - 3} სხვა</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Day schedule */}
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold">{formatDate(selectedDate)}</h2>
              <p className="text-xs text-slate-500">{dayAppointments.length} ვიზიტი</p>
            </div>
            <button className="btn-secondary px-3" onClick={() => setBooking(true)} title="დამატება ამ დღეს">
              +
            </button>
          </div>
          {dayAppointments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">ამ დღეს ვიზიტები არ არის</p>
          ) : (
            <div className="max-h-[483px] divide-y divide-slate-100 overflow-y-auto">
              {dayAppointments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="flex w-full gap-4 px-5 py-3 text-left hover:bg-slate-50"
                >
                  <span className="w-12 shrink-0 font-semibold text-teal-700">{formatTime(a.time)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{fullName(a.patients)}</span>
                    <span className="block truncate text-sm text-slate-500">
                      {a.reason ?? "—"}
                      {a.doctors ? ` · ${a.doctors.name}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Rendered first so appointment details / booking open on top of it. */}
      {dayOpen && (
        <DaySchedule
          date={selectedDate}
          appointments={dayAppointments}
          onClose={() => {
            setDayOpen(false);
            setBlockError(null);
          }}
          onOpenAppointment={setSelected}
          onBook={(time) => {
            setBookingTime(time);
            setBooking(true);
          }}
          blocked={dayBlocked}
          onToggleBlock={toggleBlock}
          onBlockDay={blockDay}
          onUnblockDay={unblockDay}
          error={blockError}
        />
      )}
      {selected && (
        <AppointmentDetails appointment={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
      {booking && (
        <AppointmentForm
          defaultDate={selectedDate}
          defaultTime={bookingTime}
          onClose={() => {
            setBooking(false);
            setBookingTime(undefined);
          }}
          onSaved={() => {
            setBooking(false);
            setBookingTime(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
