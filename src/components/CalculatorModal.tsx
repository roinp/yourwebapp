"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/localDb";
import { formatDateShort, formatPrice } from "@/lib/format";
import { useDraft } from "@/lib/useDraft";
import { buildQuoteHtml, computeQuote, emptyRow, rowTotal, type Quote, type Row } from "@/lib/quote";
import Modal from "./Modal";
import ErrorText from "./ErrorText";

type SavedCalc = {
  id: string;
  patient_name: string | null;
  discount: number;
  rows: Row[];
  total: number;
  updated_at: string;
};

const blank = () => ({ savedId: "", patient: "", discount: "", rows: [emptyRow()] });

/** Price calculator (treatments × quantity × price, minus a % discount) with saving and printing. */
export default function CalculatorModal({ onClose }: { onClose: () => void }) {
  const draft = useDraft("calculator", blank());
  const { value, setValue } = draft;
  const [view, setView] = useState<"edit" | "saved">("edit");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [patientNames, setPatientNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedJson, setSavedJson] = useState<string | null>(null);

  // Names of treatments done before and of patients, offered as suggestions.
  useEffect(() => {
    db
      .from("treatments")
      .select("procedure")
      .limit(1000)
      .then(({ data }) => setSuggestions([...new Set((data ?? []).map((t) => t.procedure.trim()))].sort()));
    db
      .from("patients")
      .select("first_name, last_name")
      .order("last_name")
      .limit(2000)
      .then(({ data }) => setPatientNames((data ?? []).map((p) => `${p.first_name} ${p.last_name}`)));
  }, []);

  const setRow = (i: number, patch: Partial<Row>) =>
    setValue({ ...value, rows: value.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const addRow = () => setValue({ ...value, rows: [...value.rows, emptyRow()] });
  const removeRow = (i: number) =>
    setValue({ ...value, rows: value.rows.length > 1 ? value.rows.filter((_, j) => j !== i) : [emptyRow()] });

  const quote = computeQuote(value.patient, value.discount, value.rows);
  const isSaved = !!value.savedId && savedJson === JSON.stringify(value);

  async function save() {
    setBusy(true);
    setError(null);
    const payload = {
      patient_name: quote.patient || null,
      discount: quote.percent,
      rows: quote.rows,
      total: quote.total,
      updated_at: new Date().toISOString(),
    };
    const res = value.savedId
      ? await db.from("calculations").update(payload).eq("id", value.savedId).select("id").single()
      : await db.from("calculations").insert(payload).select("id").single();
    setBusy(false);
    if (res.error) return setError(res.error.message);
    const next = { ...value, savedId: res.data.id };
    setValue(next);
    setSavedJson(JSON.stringify(next));
  }

  function open(c: SavedCalc) {
    const next = {
      savedId: c.id,
      patient: c.patient_name ?? "",
      discount: c.discount ? String(c.discount) : "",
      rows: c.rows.length ? c.rows : [emptyRow()],
    };
    setValue(next);
    setSavedJson(JSON.stringify(next));
    setError(null);
    setView("edit");
  }

  function startNew() {
    draft.reset();
    setSavedJson(null);
    setError(null);
  }

  if (view === "saved") {
    return (
      <Modal title="📂 შენახული კალკულაციები" onClose={onClose} wide>
        <SavedList
          currentId={value.savedId}
          onOpen={open}
          onBack={() => setView("edit")}
          onDeleted={(id) => {
            if (id === value.savedId) {
              setValue({ ...value, savedId: "" });
              setSavedJson(null);
            }
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal title="🧮 კალკულაცია" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary py-1.5" onClick={() => setView("saved")}>
            📂 შენახული
          </button>
          <button type="button" className="btn-secondary py-1.5" onClick={startNew}>
            + ახალი
          </button>
          <span className={`ml-auto text-sm ${isSaved ? "text-emerald-700" : "text-slate-400"}`}>
            {isSaved ? "✓ შენახულია" : value.savedId ? "● შეუნახავი ცვლილებები" : "ახალი კალკულაცია"}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="min-w-48 flex-1">
            <label className="label">პაციენტი</label>
            <input
              className="input"
              list="calc-patients"
              placeholder="სახელი, გვარი"
              value={value.patient}
              onChange={(e) => setValue({ ...value, patient: e.target.value })}
            />
            <datalist id="calc-patients">
              {patientNames.map((n, i) => (
                <option key={i} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">ფასდაკლება</label>
            <div className="relative w-32">
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                className="input pr-8 tabular-nums"
                placeholder="0"
                value={value.discount}
                onChange={(e) => setValue({ ...value, discount: e.target.value })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">%</span>
            </div>
          </div>
        </div>

        <datalist id="calc-treatments">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div>
          <div className="hidden grid-cols-[1fr_80px_100px_100px_32px] gap-2 px-1 pb-1 text-xs font-medium text-slate-500 sm:grid">
            <span>დასახელება</span>
            <span>რაოდენობა</span>
            <span>ფასი (₾)</span>
            <span className="text-right">ჯამი</span>
            <span />
          </div>
          <div className="space-y-2">
            {value.rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_80px_100px_100px_32px] sm:border-0 sm:p-0"
              >
                <input
                  className="input col-span-4 sm:col-span-1"
                  list="calc-treatments"
                  placeholder="მკურნალობა"
                  value={r.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input tabular-nums"
                  placeholder="1"
                  title="ცარიელი = 1"
                  value={r.qty}
                  onChange={(e) => setRow(i, { qty: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input tabular-nums"
                  placeholder="0.00"
                  value={r.price}
                  onChange={(e) => setRow(i, { price: e.target.value })}
                  onKeyDown={(e) => {
                    // Enter in the last price field adds a new row.
                    if (e.key === "Enter" && i === value.rows.length - 1) {
                      e.preventDefault();
                      addRow();
                    }
                  }}
                />
                <div className="flex items-center justify-end rounded-lg bg-slate-50 px-2 text-sm font-semibold tabular-nums">
                  {rowTotal(r).toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="წაშლა"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary mt-3" onClick={addRow}>
            + რიგის დამატება
          </button>
        </div>

        <div className="ml-auto max-w-xs space-y-1.5 rounded-lg border border-slate-200 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">ჯამი</span>
            <span className="tabular-nums">{formatPrice(quote.subtotal)}</span>
          </div>
          {quote.percent > 0 && (
            <div className="flex justify-between text-red-600">
              <span>ფასდაკლება ({quote.percent}%)</span>
              <span className="tabular-nums">−{formatPrice(quote.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold">
            <span>გადასახდელი</span>
            <span className="tabular-nums text-teal-700">{formatPrice(quote.total)}</span>
          </div>
        </div>

        <ErrorText error={error} />

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary mr-auto" onClick={onClose}>
            დახურვა
          </button>
          <button type="button" className="btn-secondary text-red-600" onClick={startNew}>
            გასუფთავება
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || quote.rows.length === 0 || isSaved}
            onClick={save}
          >
            {busy ? "ინახება..." : "💾 შენახვა"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={quote.rows.length === 0}
            onClick={() => printQuote(quote)}
          >
            🖨 ბეჭდვა
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SavedList({
  currentId,
  onOpen,
  onBack,
  onDeleted,
}: {
  currentId: string;
  onOpen: (c: SavedCalc) => void;
  onBack: () => void;
  onDeleted: (id: string) => void;
}) {
  const [items, setItems] = useState<SavedCalc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    db
      .from("calculations")
      .select("id, patient_name, discount, rows, total, updated_at")
      .order("updated_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        setItems(data ?? []);
      });
  }, []);

  async function remove(id: string) {
    const { error } = await db.from("calculations").delete().eq("id", id);
    setConfirmId(null);
    if (error) return setError(error.message);
    setItems((list) => (list ?? []).filter((c) => c.id !== id));
    onDeleted(id);
  }

  const q = search.trim().toLowerCase();
  const visible = (items ?? []).filter((c) => !q || (c.patient_name ?? "").toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary py-1.5" onClick={onBack}>
          ← კალკულაცია
        </button>
        <input
          className="input max-w-xs flex-1"
          placeholder="🔍 ძებნა პაციენტით..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ErrorText error={error} />
      {!items && !error && <p className="text-sm text-slate-400">იტვირთება...</p>}
      {items && visible.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">
          {items.length ? "ვერ მოიძებნა" : "შენახული კალკულაციები ჯერ არ არის"}
        </p>
      )}
      <div className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {visible.map((c) => (
          <div
            key={c.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${c.id === currentId ? "bg-teal-50" : ""}`}
          >
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(c)}>
              <p className="truncate font-medium">{c.patient_name || "უსახელო"}</p>
              <p className="text-xs text-slate-500">
                {formatDateShort(c.updated_at.slice(0, 10))} · {c.rows.length} პოზიცია
                {c.discount > 0 && ` · −${Number(c.discount)}%`}
              </p>
            </button>
            <span className="font-semibold tabular-nums text-teal-700">{formatPrice(c.total)}</span>
            {confirmId === c.id ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-red-600">წაიშალოს?</span>
                <button className="btn-secondary px-2 py-1" onClick={() => setConfirmId(null)}>
                  არა
                </button>
                <button className="btn-danger px-2 py-1" onClick={() => remove(c.id)}>
                  დიახ
                </button>
              </span>
            ) : (
              <span className="flex gap-1">
                <button className="btn-secondary px-2.5 py-1" onClick={() => onOpen(c)}>
                  გახსნა
                </button>
                <button
                  className="btn-secondary px-2.5 py-1"
                  title="ბეჭდვა"
                  onClick={() => printQuote(computeQuote(c.patient_name ?? "", c.discount, c.rows))}
                >
                  🖨
                </button>
                <button
                  className="rounded-lg px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="წაშლა"
                  onClick={() => setConfirmId(c.id)}
                >
                  🗑
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Prints the estimate through a hidden iframe (no new tab). */
function printQuote(q: Quote) {
  const html = buildQuoteHtml(q);
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  // Give the fonts a moment to load, then print and clean up.
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 300);
}
