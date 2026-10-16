"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/localDb";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import type { Patient } from "@/lib/types";
import PatientForm from "@/components/PatientForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination, { paginate } from "@/components/Pagination";

type PatientRow = Patient & { appointments: { date: string; time: string }[] };

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Patient | null | "new">(null);
  const [deleting, setDeleting] = useState<Patient | null>(null);
  // Remember the page so returning from a patient profile lands on the same page.
  const [page, setPage] = useState(() => {
    try {
      return Number(sessionStorage.getItem("patients:page")) || 1;
    } catch {
      return 1;
    }
  });

  const load = useCallback(async () => {
    // Each patient with only their most recent past appointment (last visit).
    const { data } = await db
      .from("patients")
      .select("*, appointments(date, time)")
      .lte("appointments.date", todayISO())
      .order("date", { referencedTable: "appointments", ascending: false })
      .order("time", { referencedTable: "appointments", ascending: false })
      .limit(1, { referencedTable: "appointments" })
      .order("last_name")
      .order("first_name");
    setPatients(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? patients.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          `${p.last_name} ${p.first_name}`.toLowerCase().includes(q) ||
          (p.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
          (p.personal_id ?? "").includes(q.replace(/\s/g, "")),
      )
    : patients;

  const { pageItems, pageCount, currentPage, firstIndex } = paginate(filtered, page);

  // Row selection for bulk delete (kept across pages and searches).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const allPageSelected = pageItems.length > 0 && pageItems.every((p) => selected.has(p.id));
  const somePageSelected = pageItems.some((p) => selected.has(p.id));

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function togglePage() {
    const next = new Set(selected);
    for (const p of pageItems) {
      if (allPageSelected) next.delete(p.id);
      else next.add(p.id);
    }
    setSelected(next);
  }

  async function deleteSelected() {
    const ids = [...selected];
    // Chunked so the request URL stays short with many patients.
    for (let i = 0; i < ids.length; i += 100) {
      await db.from("patients").delete().in("id", ids.slice(i, i + 100));
    }
    setSelected(new Set());
    setBulkDeleting(false);
    load();
  }

  function goToPage(p: number) {
    setPage(p);
    try {
      sessionStorage.setItem("patients:page", String(p));
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">პაციენტები</h1>
        <button className="btn-primary" onClick={() => setEditing("new")}>
          + ახალი პაციენტი
        </button>
      </div>

      <input
        className="input max-w-md"
        placeholder="🔍 ძებნა სახელით, ტელეფონით ან პირადი ნომრით..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          goToPage(1);
        }}
      />

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm">
          <span className="font-medium text-teal-800">მონიშნულია: {selected.size}</span>
          {selected.size < filtered.length && (
            <button
              className="text-teal-700 underline hover:no-underline"
              onClick={() => setSelected(new Set(filtered.map((p) => p.id)))}
            >
              მონიშნე ყველა ({filtered.length})
            </button>
          )}
          <button className="text-slate-600 underline hover:no-underline" onClick={() => setSelected(new Set())}>
            მონიშვნის მოხსნა
          </button>
          <button className="btn-danger ml-auto py-1.5" onClick={() => setBulkDeleting(true)}>
            🗑 წაშლა ({selected.size})
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-400">იტვირთება...</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-slate-400">
            {q ? "პაციენტი ვერ მოიძებნა" : "პაციენტები ჯერ არ არის დამატებული"}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">სახელი, გვარი</th>
                <th className="px-5 py-3 font-medium">ტელეფონი</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">პირადი ნომერი</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">ბოლო ვიზიტი</th>
                <th className="px-5 py-3" />
                <th className="w-12 py-3 pl-2 pr-5 text-right">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-teal-600 align-middle"
                    title="გვერდზე ყველას მონიშვნა"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected && !allPageSelected;
                    }}
                    onChange={togglePage}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((p) => (
                <tr key={p.id} className={selected.has(p.id) ? "bg-teal-50/60" : "hover:bg-slate-50"}>
                  <td className="px-5 py-3">
                    <Link href={`/patients/${p.id}`} className="font-medium text-teal-700 hover:underline">
                      {p.first_name} {p.last_name}
                    </Link>
                    {p.personal_id && <p className="text-xs tabular-nums text-slate-400 sm:hidden">პ/ნ {p.personal_id}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.phone ?? "—"}</td>
                  <td className="hidden whitespace-nowrap px-5 py-3 tabular-nums text-slate-600 sm:table-cell">{p.personal_id ?? "—"}</td>
                  <td className="hidden whitespace-nowrap px-5 py-3 text-slate-600 md:table-cell">
                    {p.appointments[0] ? (
                      <>
                        {formatDate(p.appointments[0].date)}
                        <span className="ml-2 text-slate-400">{formatTime(p.appointments[0].time)}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">ვიზიტი არ ყოფილა</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <button
                      className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      onClick={() => setEditing(p)}
                      title="რედაქტირება"
                    >
                      ✎
                    </button>
                    <button
                      className="rounded px-2 py-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => setDeleting(p)}
                      title="წაშლა"
                    >
                      🗑
                    </button>
                  </td>
                  <td className="w-12 py-3 pl-2 pr-5 text-right">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-teal-600 align-middle"
                      aria-label={`${p.first_name} ${p.last_name} — მონიშვნა`}
                      checked={selected.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-slate-400">
          {filtered.length > 0
            ? `ნაჩვენებია ${firstIndex + 1}–${firstIndex + pageItems.length}, სულ ${filtered.length}`
            : "სულ: 0"}
        </p>
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          onChange={(p) => {
            goToPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>

      {editing && (
        <PatientForm
          patient={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={`წაიშალოს პაციენტი „${deleting.first_name} ${deleting.last_name}"? წაიშლება მისი ვიზიტები და მკურნალობის ისტორიაც.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await db.from("patients").delete().eq("id", deleting.id);
            if (selected.has(deleting.id)) toggleOne(deleting.id);
            setDeleting(null);
            load();
          }}
        />
      )}
      {bulkDeleting && (
        <ConfirmDialog
          message={`წაიშალოს ${selected.size} პაციენტი? წაიშლება მათი ვიზიტები და მკურნალობის ისტორიაც. ამ მოქმედების დაბრუნება შეუძლებელია.`}
          onClose={() => setBulkDeleting(false)}
          onConfirm={deleteSelected}
        />
      )}
    </div>
  );
}
