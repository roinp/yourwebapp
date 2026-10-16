"use client";

import { TIME_SLOTS, formatDate, formatTime, fullName } from "@/lib/format";
import type { Appointment } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";

/**
 * Popup with a day's full schedule: booked slots show the patient, free slots can be booked,
 * and free slots can be blocked so no patient gets booked at that time.
 */
export default function DaySchedule({
  date,
  appointments,
  onClose,
  onOpenAppointment,
  onBook,
  blocked,
  onToggleBlock,
  onBlockDay,
  onUnblockDay,
  error,
}: {
  date: string;
  appointments: Appointment[];
  onClose: () => void;
  onOpenAppointment: (a: Appointment) => void;
  onBook: (time: string) => void;
  /** Blocked times on this day, as HH:MM. */
  blocked: Set<string>;
  onToggleBlock: (time: string) => void;
  onBlockDay: (times: string[]) => void;
  onUnblockDay: () => void;
  error?: string | null;
}) {
  const byTime = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const t = formatTime(a.time);
    byTime.set(t, [...(byTime.get(t) ?? []), a]);
  }
  // Standard slots plus any appointment booked outside them (e.g. 10:15).
  const times = [...new Set([...TIME_SLOTS, ...byTime.keys(), ...blocked])].sort();
  const openSlots = TIME_SLOTS.filter((t) => !byTime.has(t) && !blocked.has(t));
  const blockedCount = times.filter((t) => !byTime.has(t) && blocked.has(t)).length;

  const rows = times.flatMap((t) => {
    const booked = byTime.get(t);
    if (!booked && blocked.has(t)) {
      return (
        <div
          key={t}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm"
        >
          <span className="w-11 font-semibold tabular-nums text-slate-500 line-through">{t}</span>
          <span className="flex-1 text-slate-500">🔒 დაბლოკილი</span>
          <button
            type="button"
            onClick={() => onToggleBlock(t)}
            className="rounded px-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          >
            განბლოკვა
          </button>
        </div>
      );
    }
    if (!booked) {
      return (
        <div
          key={t}
          className="group flex w-full items-center rounded-lg border border-emerald-100 bg-emerald-50/50 text-sm transition hover:border-emerald-300 hover:bg-emerald-50"
        >
          <button
            type="button"
            onClick={() => onBook(t)}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2.5 text-left"
          >
            <span className="w-11 font-semibold tabular-nums text-emerald-700">{t}</span>
            <span className="flex-1 text-emerald-600">თავისუფალი</span>
            <span className="text-xs font-medium text-emerald-700 opacity-0 transition group-hover:opacity-100">
              + დაჯავშნა
            </span>
          </button>
          <button
            type="button"
            onClick={() => onToggleBlock(t)}
            title="საათის დაბლოკვა"
            aria-label={`${t} დაბლოკვა`}
            className="mx-1 rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            🔒
          </button>
        </div>
      );
    }
    return booked.map((a) => (
      <button
        key={a.id}
        type="button"
        onClick={() => onOpenAppointment(a)}
        title={[a.reason, a.doctors?.name, a.patients?.phone].filter(Boolean).join(" · ")}
        className="flex w-full items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-left text-sm transition hover:border-red-300"
      >
        <span className="w-11 shrink-0 font-semibold tabular-nums text-red-700">{t}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-900">{fullName(a.patients)}</span>
          {(a.reason || a.doctors) && (
            <span className="block truncate text-xs text-slate-500">
              {[a.reason, a.doctors?.name].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
      </button>
    ));
  });

  // Fill the left column top-to-bottom first, then the right one.
  const half = Math.ceil(rows.length / 2);
  const columns = [rows.slice(0, half), rows.slice(half)];

  return (
    <Modal title={formatDate(date)} onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">
          დაჯავშნილი: {appointments.length}
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
          თავისუფალი: {openSlots.length}
        </span>
        {blockedCount > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            დაბლოკილი: {blockedCount}
          </span>
        )}
        <span className="ml-auto flex gap-1.5">
          {openSlots.length > 0 && (
            <button
              type="button"
              onClick={() => onBlockDay(openSlots)}
              className="rounded-full border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100"
            >
              🔒 მთელი დღის დაბლოკვა
            </button>
          )}
          {blocked.size > 0 && (
            <button
              type="button"
              onClick={onUnblockDay}
              className="rounded-full border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100"
            >
              🔓 ყველას განბლოკვა
            </button>
          )}
        </span>
      </div>

      {error && (
        <div className="mb-3">
          <ErrorText error={error} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-x-3">
        {columns.map((col, i) => (
          <div key={i} className="space-y-1.5">
            {col}
          </div>
        ))}
      </div>
    </Modal>
  );
}
