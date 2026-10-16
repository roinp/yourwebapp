"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/localDb";
import type { Doctor } from "@/lib/types";
import DoctorForm from "@/components/DoctorForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination, { paginate } from "@/components/Pagination";

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Doctor | null | "new">(null);
  const [deleting, setDeleting] = useState<Doctor | null>(null);

  const load = useCallback(async () => {
    const { data } = await db.from("doctors").select("*").order("name");
    setDoctors(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const { pageItems, pageCount, currentPage } = paginate(doctors, page);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">ექიმები</h1>
        <button className="btn-primary" onClick={() => setEditing("new")}>
          + ახალი ექიმი
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">იტვირთება...</p>
      ) : doctors.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">ექიმები ჯერ არ არის დამატებული</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((d) => (
            <div key={d.id} className="card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 font-semibold text-sky-700">
                  {d.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.name}</p>
                  <p className="text-sm text-slate-500">{d.specialty ?? "—"}</p>
                  <p className="mt-2 text-sm">{d.phone ? `📞 ${d.phone}` : "—"}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button className="btn-secondary px-3 py-1.5" onClick={() => setEditing(d)}>
                  რედაქტირება
                </button>
                <button className="btn-secondary px-3 py-1.5 text-red-600" onClick={() => setDeleting(d)}>
                  წაშლა
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />

      {editing && (
        <DoctorForm
          doctor={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={`წაიშალოს ექიმი „${deleting.name}"? მისი ვიზიტები და ჩანაწერები დარჩება, ექიმის გარეშე.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await db.from("doctors").delete().eq("id", deleting.id);
            setDeleting(null);
            load();
          }}
        />
      )}
    </div>
  );
}
