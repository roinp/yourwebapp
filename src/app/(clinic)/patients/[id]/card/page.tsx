"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { db } from "@/lib/localDb";
import { formatDate, todayISO } from "@/lib/format";
import { useDoctors } from "@/lib/useDoctors";
import { useDraft } from "@/lib/useDraft";
import {
  COMPLAINTS_LEFT,
  COMPLAINTS_RIGHT,
  PERIO_OPTIONS,
  PLAN_LEFT,
  PLAN_RIGHT,
  PLAQUE_OPTIONS,
  PRIMARY_LOWER,
  PRIMARY_UPPER,
  SEX_OPTIONS,
  TEETH_LOWER,
  TEETH_UPPER,
  TOOTH_CODES,
  emptyCard,
  normalizeCard,
  type MedicalCardData,
} from "@/lib/medicalCard";
import type { Patient, Treatment } from "@/lib/types";
import ErrorText from "@/components/ErrorText";
import DraftNotice from "@/components/DraftNotice";

type Loaded = { patient: Patient; card: MedicalCardData; cardNumber: number | null };

export default function MedicalCardPage() {
  const { id } = useParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      db.from("patients").select("*").eq("id", id).maybeSingle(),
      db.from("medical_cards").select("card_number, data").eq("patient_id", id).maybeSingle(),
    ]).then(([p, c]) => {
      if (c.error) return setLoadError(c.error.message);
      if (!p.data) return setLoadError("პაციენტი ვერ მოიძებნა");
      setLoaded({ patient: p.data, card: normalizeCard(c.data?.data), cardNumber: c.data?.card_number ?? null });
    });
  }, [id]);

  if (loadError) {
    return (
      <div className="card space-y-2 p-8 text-center">
        <p className="text-red-600">სამედიცინო ბარათი ვერ ჩაიტვირთა.</p>
        <p className="text-xs text-slate-400">{loadError}</p>
      </div>
    );
  }
  if (!loaded) return <p className="text-slate-400">იტვირთება...</p>;
  return <CardForm patientId={id} {...loaded} />;
}

function CardForm({ patientId, patient, card, cardNumber: initialNumber }: Loaded & { patientId: string }) {
  const doctors = useDoctors();
  const draft = useDraft(`card:${patientId}`, card);
  const { value: form, setValue: setForm } = draft;
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(card));
  const [cardNumber, setCardNumber] = useState(initialNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrimary, setShowPrimary] = useState(() =>
    [...PRIMARY_UPPER, ...PRIMARY_LOWER].some((t) => card.teeth[t]),
  );

  const isSaved = cardNumber !== null && JSON.stringify(form) === savedJson;

  function update<K extends keyof MedicalCardData>(key: K, value: MedicalCardData[K]) {
    setForm({ ...form, [key]: value });
  }
  const text = (key: keyof MedicalCardData) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update(key, e.target.value as never),
  });
  function toggle(key: "complaints" | "perio" | "plaque" | "plan", item: string) {
    const list = form[key];
    update(key, list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  /** Saves the card and its history copy; returns false if the card could not be saved. */
  async function save(): Promise<boolean> {
    setBusy(true);
    setError(null);
    const { data, error } = await db
      .from("medical_cards")
      .upsert(
        { patient_id: patientId, data: form, updated_at: new Date().toISOString() },
        { onConflict: "patient_id" },
      )
      .select("card_number")
      .single();
    if (error) {
      setBusy(false);
      setError(error.message);
      return false;
    }
    // History copy: today's entry of this examination is updated, otherwise a new entry is added.
    const today = todayISO();
    const { data: todays } = await db
      .from("medical_card_versions")
      .select("id, data")
      .eq("patient_id", patientId)
      .eq("version_date", today);
    const sameExam = (todays ?? []).find(
      (v) => ((v.data as Partial<MedicalCardData>)?.exam_key ?? "") === form.exam_key,
    );
    const copy = { card_number: data.card_number, data: form, saved_at: new Date().toISOString() };
    const { error: historyError } = sameExam
      ? await db.from("medical_card_versions").update(copy).eq("id", sameExam.id)
      : await db
          .from("medical_card_versions")
          .insert({ ...copy, patient_id: patientId, version_date: today });
    setBusy(false);
    if (historyError) setError(`ბარათი შეინახა, მაგრამ ისტორიაში ვერ ჩაიწერა: ${historyError.message}`);
    setCardNumber(data.card_number);
    setSavedJson(JSON.stringify(form));
    draft.clear();
    return true;
  }

  // New examination: unsaved changes are saved to history first, then the form is cleared.
  async function startNewExam() {
    if (!isSaved && !(await save())) return;
    setForm({
      ...emptyCard(),
      provider: form.provider,
      exam_key: crypto.randomUUID(),
      exam_date: todayISO(),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function importTreatments() {
    const { data } = await db
      .from("treatments")
      .select("*, doctors(id, name)")
      .eq("patient_id", patientId)
      .order("date");
    const rows = ((data ?? []) as Treatment[]).map((t) => ({
      date: t.date,
      text: [t.procedure, t.tooth_number ? `(კბილი ${t.tooth_number})` : "", t.notes ? `— ${t.notes}` : ""]
        .filter(Boolean)
        .join(" "),
      doctor: t.doctors?.name ?? "",
    }));
    const existing = new Set(form.diary.map((r) => `${r.date}|${r.text}`));
    update("diary", [...form.diary, ...rows.filter((r) => !existing.has(`${r.date}|${r.text}`))]);
  }

  const printUrl = `/print/card/${patientId}`;

  return (
    <div className="space-y-6 pb-24">
      <Link href={`/patients/${patientId}`} className="text-sm text-slate-500 hover:text-slate-800">
        ← {patient.first_name} {patient.last_name}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            სამედიცინო ბარათი {cardNumber !== null && <span className="text-slate-400">№ {cardNumber}</span>}
          </h1>
          <p className="text-sm text-slate-500">ფორმა IV-220 · ივსება ექიმის მიერ</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/patients/${patientId}/card/history`} className="btn-secondary">
            🗂 ბარათის ისტორია
          </Link>
          <button type="button" className="btn-secondary" disabled={busy} onClick={startNewExam}>
            {busy ? "ინახება..." : "🆕 ახალი გასინჯვა"}
          </button>
        </div>
      </div>
      <DraftNotice restored={draft.restored} onReset={draft.reset} />

      <datalist id="card-doctors">
        {doctors.map((d) => (
          <option key={d.id} value={d.name} />
        ))}
      </datalist>

      {/* ===== Card ===== */}
      <Section title="პაციენტის მონაცემები">
        <div className="grid gap-4 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="გვარი, სახელი" value={`${patient.last_name} ${patient.first_name}`} />
          <Info label="დაბადების თარიღი" value={formatDate(patient.date_of_birth)} />
          <Info label="ტელეფონი" value={patient.phone ?? "—"} />
          <Info label="პირადი ნომერი" value={patient.personal_id ?? "—"} />
          <p className="text-xs text-slate-400 sm:col-span-2 lg:col-span-4">
            ეს მონაცემები პაციენტის ბარათიდან მოდის. შესაცვლელად გამოიყენეთ „რედაქტირება“ პაციენტის გვერდზე.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">სქესი</label>
            <div className="flex gap-4 pt-1.5">
              {SEX_OPTIONS.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="sex"
                    className="h-4 w-4 accent-teal-600"
                    checked={form.sex === s}
                    onChange={() => update("sex", s)}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <Field label="სამუშაო ადგილი" {...text("workplace")} />
          <div className="sm:col-span-2">
            <Field label="მისამართი" {...text("address")} />
          </div>
          <Area label="ალერგია (მათ შორის – საანესთეზიო საშუალებებზე)" {...text("allergies")} />
          <Area label="გადატანილი ან/და თანმხლები დაავადებები, მდგომარეობები" {...text("diseases")} />
          <Field label="სადაზღვევო პოლისის ნომერი" {...text("insurance_policy")} />
          <Field label="სადაზღვევო კომპანია" {...text("insurance_company")} />
        </div>
      </Section>

      {/* ===== Annex 2 ===== */}
      <Section title="პაციენტის გასინჯვის ფურცელი" subtitle="დანართი №2 · ფორმა IV-220-1/ა">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="სტომატოლოგიური მომსახურების მიმწოდებელი" {...text("provider")} />
          <div>
            <label className="label">გასინჯვის თარიღი</label>
            <div className="flex gap-2">
              <input type="date" className="input" {...text("exam_date")} />
              {!form.exam_date && (
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => update("exam_date", todayISO())}>
                  დღეს
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-medium">ჩივილები (მომართვის მიზეზი)</h3>
          <div className="mb-3 max-w-sm">
            <Field label="დაავადებული კბილ(ებ)ი" placeholder="მაგ. 36, 37" {...text("complaint_teeth")} />
          </div>
          <CheckColumns
            left={COMPLAINTS_LEFT}
            right={COMPLAINTS_RIGHT}
            selected={form.complaints}
            onToggle={(i) => toggle("complaints", i)}
          />
          <div className="mt-3">
            <Field label="სხვა" {...text("complaints_other")} />
          </div>
        </div>

        <Area label="ანამნეზი" rows={4} {...text("anamnesis")} />

        <div>
          <h3 className="mb-1 font-medium">ობიექტური გამოკვლევები — პირის ღრუს დათვალიერება</h3>
          <p className="mb-3 text-xs text-slate-500">თითოეულ კბილზე აირჩიეთ მდგომარეობის კოდი.</p>
          <ToothChart
            upper={TEETH_UPPER}
            lower={TEETH_LOWER}
            teeth={form.teeth}
            onChange={(t, v) => update("teeth", { ...form.teeth, [t]: v })}
          />
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal-600"
              checked={showPrimary}
              onChange={(e) => setShowPrimary(e.target.checked)}
            />
            სარძევე კბილები
          </label>
          {showPrimary && (
            <div className="mt-3">
              <ToothChart
                upper={PRIMARY_UPPER}
                lower={PRIMARY_LOWER}
                teeth={form.teeth}
                onChange={(t, v) => update("teeth", { ...form.teeth, [t]: v })}
              />
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            {TOOTH_CODES.map((c) => (
              <span key={c.code} className="mr-3 inline-block">
                <b className="text-slate-700">{c.code}</b> – {c.label}
              </span>
            ))}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="თანკბილვა" {...text("occlusion")} />
          <Field label="პირის ღრუს ლორწოვანი გარსის მდგომარეობა" {...text("mucosa")} />
        </div>

        <div>
          <h3 className="mb-2 font-medium">პაროდონტის მდგომარეობა</h3>
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <CheckList items={PERIO_OPTIONS} selected={form.perio} onToggle={(i) => toggle("perio", i)} />
            <div>
              <p className="mb-1 text-sm font-medium text-slate-600">ნადები:</p>
              <CheckList items={PLAQUE_OPTIONS} selected={form.plaque} onToggle={(i) => toggle("plaque", i)} />
            </div>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="პაროდონტული ჯიბის სიღრმე" {...text("pocket_depth")} />
            <Field label="სხვა" {...text("perio_other")} />
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-medium">გამოკვლევის გეგმა</h3>
          <CheckColumns left={PLAN_LEFT} right={PLAN_RIGHT} selected={form.plan} onToggle={(i) => toggle("plan", i)} />
          <div className="mt-3 max-w-md">
            <Field label="სხვა" {...text("plan_other")} />
          </div>
        </div>

        <Area label="კონსულტაცია/გამოკვლევის შედეგი" {...text("result")} />
        <Area label="საბოლოო დიაგნოზი (ICD-10)" rows={2} {...text("diagnosis")} />
        <Area label="მკურნალობა" rows={4} {...text("treatment")} />
        <div className="max-w-md">
          <Field label="მომდევნო ვიზიტი" placeholder="მაგ. 20.10.2026, 14:00" {...text("next_visit")} />
        </div>
      </Section>

      {/* Treatment diary */}
      <Section
        title="მკურნალობის დღიური"
        subtitle="თარიღი · ანამნეზი, სტატუსი, დიაგნოზი, ჩატარებული მკურნალობა, დანიშნულება · მკურნალი ექიმი"
      >
        {form.diary.length === 0 && <p className="text-sm text-slate-400">ჩანაწერები არ არის.</p>}
        <div className="space-y-2">
          {form.diary.map((row, i) => {
            const setRow = (patch: Partial<typeof row>) =>
              update(
                "diary",
                form.diary.map((r, j) => (j === i ? { ...r, ...patch } : r)),
              );
            return (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[150px_1fr_180px_auto]">
                <input type="date" className="input" value={row.date} onChange={(e) => setRow({ date: e.target.value })} />
                <textarea
                  rows={1}
                  className="input min-h-[38px]"
                  placeholder="ჩატარებული მკურნალობა, დანიშნულება..."
                  value={row.text}
                  onChange={(e) => setRow({ text: e.target.value })}
                />
                <input
                  className="input"
                  list="card-doctors"
                  placeholder="ექიმი"
                  value={row.doctor}
                  onChange={(e) => setRow({ doctor: e.target.value })}
                />
                <button
                  type="button"
                  className="rounded-lg px-3 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="წაშლა"
                  onClick={() => update("diary", form.diary.filter((_, j) => j !== i))}
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => update("diary", [...form.diary, { date: todayISO(), text: "", doctor: "" }])}
          >
            + ჩანაწერის დამატება
          </button>
          <button type="button" className="btn-secondary" onClick={importTreatments}>
            ↓ მკურნალობის ისტორიიდან შევსება
          </button>
        </div>
      </Section>

      <Section title="შედეგი და რეკომენდაციები">
        <Area label="მკურნალობის შედეგი (ეპიკრიზი)" rows={4} {...text("epicrisis")} />
        <Area label="რჩევა-დარიგება/დანიშნულება" rows={4} {...text("advice")} />
      </Section>

      {/* ===== Annex 3 ===== */}
      <Section title="ინფორმირებული თანხმობა" subtitle="დანართი №3 · ფორმა IV-220-2/ა">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="პაციენტი (სახელი, გვარი)"
            placeholder={`${patient.first_name} ${patient.last_name}`}
            {...text("consent_patient")}
          />
          <div>
            <label className="label">ექიმი (სახელი, გვარი)</label>
            <input className="input" list="card-doctors" {...text("consent_doctor")} />
          </div>
          <div>
            <label className="label">თარიღი</label>
            <input type="date" className="input" {...text("consent_date")} />
          </div>
        </div>
        <p className="text-xs text-slate-500">ხელმოწერები კეთდება დაბეჭდილ ფურცელზე.</p>
      </Section>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <span className={`text-sm ${isSaved ? "text-emerald-700" : "text-amber-600"}`}>
            {isSaved ? "✓ შენახულია" : cardNumber === null ? "ბარათი ჯერ არ არის შენახული" : "● შეუნახავი ცვლილებები"}
          </span>
          <div className="min-w-0 flex-1">
            <ErrorText error={error} />
          </div>
          <button className="btn-primary" disabled={busy || isSaved} onClick={save}>
            {busy ? "ინახება..." : "შენახვა"}
          </button>
          <a
            href={`${printUrl}?print=1`}
            target="_blank"
            className={`btn-secondary ${isSaved ? "" : "pointer-events-none opacity-40"}`}
            title={isSaved ? "" : "ჯერ შეინახეთ ბარათი"}
          >
            🖨 ბეჭდვა (A4)
          </a>
          <a
            href={`${printUrl}?word=1`}
            target="_blank"
            className={`btn-secondary ${isSaved ? "" : "pointer-events-none opacity-40"}`}
            title={isSaved ? "" : "ჯერ შეინახეთ ბარათი"}
          >
            ⬇ Word
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-5 p-5 sm:p-6">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

type InputProps = { label: string; value: string; placeholder?: string; onChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> };

function Field({ label, ...props }: InputProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" {...props} />
    </div>
  );
}

function Area({ label, rows = 3, ...props }: InputProps & { rows?: number }) {
  return (
    <div className="sm:col-span-1">
      <label className="label">{label}</label>
      <textarea rows={rows} className="input" {...props} />
    </div>
  );
}

function CheckList({
  items,
  selected,
  onToggle,
}: {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <label key={item} className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
            checked={selected.includes(item)}
            onChange={() => onToggle(item)}
          />
          {item}
        </label>
      ))}
    </div>
  );
}

function CheckColumns(props: { left: string[]; right: string[]; selected: string[]; onToggle: (item: string) => void }) {
  return (
    <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
      <CheckList items={props.left} selected={props.selected} onToggle={props.onToggle} />
      <CheckList items={props.right} selected={props.selected} onToggle={props.onToggle} />
    </div>
  );
}

function ToothChart({
  upper,
  lower,
  teeth,
  onChange,
}: {
  upper: string[];
  lower: string[];
  teeth: Record<string, string>;
  onChange: (tooth: string, code: string) => void;
}) {
  const half = upper.length / 2;
  const cell = (t: string, i: number, numberOnTop: boolean) => (
    <div key={t} className={`flex flex-col items-center gap-0.5 ${i === half ? "border-l-2 border-slate-400 pl-1" : ""}`}>
      {numberOnTop && <span className="text-[11px] font-semibold text-slate-500">{t}</span>}
      {/* The closed select shows only the code (overlay); the open list shows full names. */}
      <div className="relative w-full">
        <select
          value={teeth[t] ?? ""}
          onChange={(e) => onChange(t, e.target.value)}
          title={`კბილი ${t}${teeth[t] ? ` — ${TOOTH_CODES.find((c) => c.code === teeth[t])?.label}` : ""}`}
          className={`h-8 w-full min-w-0 cursor-pointer appearance-none rounded border text-xs text-transparent outline-none focus:ring-2 focus:ring-teal-200 ${
            teeth[t] ? "border-teal-400 bg-teal-50" : "border-slate-300 bg-white"
          }`}
        >
          <option value="" className="text-slate-900">
            — ჯანმრთელი / ცარიელი
          </option>
          {TOOTH_CODES.map((c) => (
            <option key={c.code} value={c.code} className="text-slate-900">
              {c.code} – {c.label}
            </option>
          ))}
        </select>
        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold ${
            teeth[t] ? "text-teal-800" : "text-slate-300"
          }`}
        >
          {teeth[t] || "·"}
        </span>
      </div>
      {!numberOnTop && <span className="text-[11px] font-semibold text-slate-500">{t}</span>}
    </div>
  );
  const grid = { gridTemplateColumns: `repeat(${upper.length}, minmax(0, 1fr))` };
  return (
    <div className="max-w-3xl space-y-1 overflow-x-auto">
      <div className="grid gap-1 border-b-2 border-slate-400 pb-1" style={grid}>
        {upper.map((t, i) => cell(t, i, true))}
      </div>
      <div className="grid gap-1" style={grid}>
        {lower.map((t, i) => cell(t, i, false))}
      </div>
    </div>
  );
}
