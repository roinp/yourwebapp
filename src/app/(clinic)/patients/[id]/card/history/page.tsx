"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { db } from "@/lib/localDb";
import { formatDate, formatDateShort } from "@/lib/format";
import { normalizeCard, type MedicalCardData } from "@/lib/medicalCard";
import type { Patient } from "@/lib/types";
import Pagination, { paginate } from "@/components/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";

type Version = {
  id: string;
  card_number: number | null;
  version_date: string;
  saved_at: string;
  data: MedicalCardData;
};

/** Dated copies of a patient's medical card, newest first. */
export default function CardHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function toggleOne(versionId: string) {
    const next = new Set(selected);
    if (next.has(versionId)) next.delete(versionId);
    else next.add(versionId);
    setSelected(next);
  }

  async function deleteSelected() {
    const ids = [...selected];
    const { error } = await db.from("medical_card_versions").delete().in("id", ids);
    setConfirmDelete(false);
    if (error) return setDeleteError(error.message);
    setDeleteError(null);
    setVersions((list) => (list ?? []).filter((v) => !selected.has(v.id)));
    setSelected(new Set());
  }

  useEffect(() => {
    Promise.all([
      db.from("patients").select("*").eq("id", id).maybeSingle(),
      db
        .from("medical_card_versions")
        .select("id, card_number, version_date, saved_at, data")
        .eq("patient_id", id)
        .order("version_date", { ascending: false })
        .order("saved_at", { ascending: false }),
    ]).then(([p, v]) => {
      if (v.error) return setError(v.error.message);
      setPatient(p.data);
      setVersions((v.data ?? []).map((x) => ({ ...x, data: normalizeCard(x.data) })));
    });
  }, [id]);

  if (error) {
    return (
      <div className="card space-y-2 p-8 text-center">
        <p className="text-red-600">ბარათის ისტორია ვერ ჩაიტვირთა.</p>
        <p className="text-xs text-slate-400">{error}</p>
      </div>
    );
  }
  if (!versions) return <p className="text-slate-400">იტვირთება...</p>;

  const { pageItems, pageCount, currentPage } = paginate(versions, page);
  const allPageSelected = pageItems.length > 0 && pageItems.every((v) => selected.has(v.id));
  const somePageSelected = pageItems.some((v) => selected.has(v.id));

  function togglePage() {
    const next = new Set(selected);
    for (const v of pageItems) {
      if (allPageSelected) next.delete(v.id);
      else next.add(v.id);
    }
    setSelected(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
        <Link href={`/patients/${id}`} className="hover:text-slate-800">
          ← {patient ? `${patient.first_name} ${patient.last_name}` : "პაციენტი"}
        </Link>
        <Link href={`/patients/${id}/card`} className="hover:text-slate-800">
          📋 მიმდინარე ბარათი
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">ბარათის ისტორია</h1>
        <p className="text-sm text-slate-500">
          ბარათის შენახვისას აქ ინახება ასლი — ერთი თითო გასინჯვაზე დღეში.
        </p>
      </div>

      {versions.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          ისტორია ცარიელია. ასლი გაჩნდება სამედიცინო ბარათის პირველი შენახვისას.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {/* Selection bar */}
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm ${
              selected.size ? "bg-teal-50" : "bg-slate-50"
            }`}
          >
            <label className="flex cursor-pointer items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-teal-600"
                checked={allPageSelected}
                ref={(el) => {
                  if (el) el.indeterminate = somePageSelected && !allPageSelected;
                }}
                onChange={togglePage}
              />
              ყველას მონიშვნა
            </label>
            {selected.size > 0 && (
              <>
                <span className="font-medium text-teal-800">მონიშნულია: {selected.size}</span>
                <button className="text-slate-600 underline hover:no-underline" onClick={() => setSelected(new Set())}>
                  მოხსნა
                </button>
                <button className="btn-danger ml-auto py-1.5" onClick={() => setConfirmDelete(true)}>
                  🗑 წაშლა ({selected.size})
                </button>
              </>
            )}
          </div>
          {deleteError && <p className="px-5 py-2 text-sm text-red-600">{deleteError}</p>}

          {pageItems.map((v, i) => {
            const isLatest = currentPage === 1 && i === 0;
            const summary = [
              v.data.exam_date && `გასინჯვა: ${formatDateShort(v.data.exam_date)}`,
              v.data.diagnosis && `დიაგნოზი: ${v.data.diagnosis.split("\n")[0]}`,
              v.data.complaints.length > 0 && `ჩივილები: ${v.data.complaints.length}`,
              v.data.diary.length > 0 && `დღიური: ${v.data.diary.length} ჩანაწერი`,
            ].filter(Boolean);
            const url = `/print/card/${id}?version=${v.id}`;
            return (
              <div
                key={v.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 ${
                  selected.has(v.id) ? "bg-teal-50/60" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
                  aria-label={`${formatDate(v.version_date)} — მონიშვნა`}
                  checked={selected.has(v.id)}
                  onChange={() => toggleOne(v.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {formatDate(v.version_date)}
                    {isLatest && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        ბოლო
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    შენახულია {new Date(v.saved_at).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit" })}
                    {v.card_number !== null && ` · ბარათი № ${v.card_number}`}
                  </p>
                  {summary.length > 0 && (
                    <p className="mt-1 truncate text-sm text-slate-600 [overflow-wrap:anywhere]">{summary.join(" · ")}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <a href={url} target="_blank" className="btn-secondary py-1.5">
                    👁 ნახვა / 🖨 ბეჭდვა
                  </a>
                  <a href={`${url}&word=1`} target="_blank" className="btn-secondary py-1.5">
                    ⬇ Word
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />

      {confirmDelete && (
        <ConfirmDialog
          message={`წაიშალოს ისტორიიდან ${selected.size} ჩანაწერი? ამ მოქმედების დაბრუნება შეუძლებელია. მიმდინარე სამედიცინო ბარათი არ წაიშლება.`}
          onClose={() => setConfirmDelete(false)}
          onConfirm={deleteSelected}
        />
      )}
    </div>
  );
}
