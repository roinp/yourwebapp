"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/localDb";
import { formatDateShort, formatPrice } from "@/lib/format";
import type { Expense } from "@/lib/types";
import ExpenseForm, { EXPENSE_CATEGORIES } from "@/components/ExpenseForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination, { paginate } from "@/components/Pagination";
// import PasswordGate from "@/components/PasswordGate";

const totalOf = (e: Expense) => Number(e.unit_price) * Number(e.quantity);
const remainingOf = (e: Expense) => totalOf(e) - Number(e.paid);

// Demo version: the expenses page opens without a password.
// // SHA-256 of the expenses password (the password itself is not stored in code).
// const EXPENSES_PASSWORD_HASH = "3230c6c3d1e07097503bd32c96aa71d879831ab6a13f1e322383a76b4ab02911";

export default function ExpensesPage() {
  return <Expenses />;
  // return (
  //   <PasswordGate title="ხარჯები" passwordHash={EXPENSES_PASSWORD_HASH}>
  //     <Expenses />
  //   </PasswordGate>
  // );
}

function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Expense | null | "new">(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db
      .from("expenses")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoadError(error ? error.message : null);
    setExpenses(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = expenses.filter(
    (e) =>
      (!q || e.item.toLowerCase().includes(q) || (e.supplier ?? "").toLowerCase().includes(q)) &&
      (!category || e.category === category) &&
      (!onlyUnpaid || remainingOf(e) > 0),
  );

  const sum = (f: (e: Expense) => number) => filtered.reduce((s, e) => s + f(e), 0);
  const total = sum(totalOf);
  const paid = sum((e) => Number(e.paid));
  const remaining = total - paid;

  const categories = [...new Set([...EXPENSE_CATEGORIES, ...expenses.map((e) => e.category).filter(Boolean)])];

  const { pageItems, pageCount, currentPage } = paginate(filtered, page);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">ხარჯები</h1>
        <button className="btn-primary" onClick={() => setEditing("new")}>
          + ახალი ხარჯი
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="სულ ხარჯი" value={formatPrice(total)} color="text-slate-900" />
        <Stat label="გადარიცხული" value={formatPrice(paid)} color="text-emerald-700" />
        <Stat
          label="დარჩენილი გადასახდელი"
          value={formatPrice(remaining)}
          color={remaining > 0 ? "text-red-600" : "text-slate-400"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="🔍 ძებნა დასახელებით ან კომპანიით..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input w-auto"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">ყველა კატეგორია</option>
          {categories.map((c) => (
            <option key={c} value={c!}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-teal-600"
            checked={onlyUnpaid}
            onChange={(e) => {
              setOnlyUnpaid(e.target.checked);
              setPage(1);
            }}
          />
          მხოლოდ დავალიანებით
        </label>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-400">იტვირთება...</p>
        ) : loadError ? (
          <p className="p-8 text-center text-sm text-red-600">
            ხარჯების ცხრილი ვერ ჩაიტვირთა.
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-slate-400">
            {expenses.length ? "ხარჯი ვერ მოიძებნა" : "ხარჯები ჯერ არ არის დამატებული"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm lg:min-w-0">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">თარიღი</th>
                  <th className="px-3 py-3 font-medium">დასახელება / კომპანია</th>
                  <th className="px-3 py-3 text-right font-medium">ფასი × რაოდ.</th>
                  <th className="px-3 py-3 text-right font-medium">სულ</th>
                  <th className="px-3 py-3 text-right font-medium">გადარიცხული</th>
                  <th className="px-3 py-3 text-right font-medium">დარჩენილი</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((e) => {
                  const left = remainingOf(e);
                  return (
                    <tr key={e.id} className="align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatDateShort(e.date)}</td>
                      <td className="px-3 py-3 [overflow-wrap:anywhere]">
                        <p className="font-medium">
                          {e.item}
                          {e.category && (
                            <span className="ml-1.5 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                              {e.category}
                            </span>
                          )}
                        </p>
                        {e.supplier && <p className="mt-0.5 text-xs text-slate-500">🏢 {e.supplier}</p>}
                        {e.notes && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-400">{e.notes}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-600">
                        {formatPrice(e.unit_price)}
                        <span className="text-slate-400"> × {Number(e.quantity)}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium">{formatPrice(totalOf(e))}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-emerald-700">{formatPrice(e.paid)}</td>
                      <td
                        className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${
                          left > 0 ? "text-red-600" : "text-slate-400"
                        }`}
                      >
                        {formatPrice(left)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <button
                          className="rounded px-1.5 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          onClick={() => setEditing(e)}
                          title="რედაქტირება"
                        >
                          ✎
                        </button>
                        <button
                          className="rounded px-1.5 py-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setDeleting(e)}
                          title="წაშლა"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-3" colSpan={3}>
                    ჯამი ({filtered.length})
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{formatPrice(total)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-emerald-700">{formatPrice(paid)}</td>
                  <td
                    className={`whitespace-nowrap px-3 py-3 text-right ${remaining > 0 ? "text-red-600" : "text-slate-400"}`}
                  >
                    {formatPrice(remaining)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {editing && (
        <ExpenseForm
          expense={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={`წაიშალოს ხარჯი „${deleting.item}“?`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await db.from("expenses").delete().eq("id", deleting.id);
            setDeleting(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
