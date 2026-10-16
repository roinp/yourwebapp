"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/localDb";
import { formatDate } from "@/lib/format";
import type { Treatment } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";

const BUCKET = "xrays";
const MAX_MB = 15;

/** All X-ray paths of a treatment, including one saved by the older single-image version. */
export function xrayPathsOf(t: Pick<Treatment, "xray_paths" | "xray_path">) {
  const paths = t.xray_paths ?? [];
  return t.xray_path && !paths.includes(t.xray_path) ? [t.xray_path, ...paths] : paths;
}

/** Gallery of a treatment's X-ray images: upload several, view large, delete. */
export default function XrayModal({
  treatment,
  onClose,
  onChanged,
}: {
  treatment: Treatment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [paths, setPaths] = useState(() => xrayPathsOf(treatment));
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Private bucket: show images through short-lived signed URLs.
  useEffect(() => {
    const missing = paths.filter((p) => !urls[p]);
    if (!missing.length) return;
    db.storage
      .from(BUCKET)
      .createSignedUrls(missing, 60 * 60)
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        setUrls((prev) => {
          const next = { ...prev };
          for (const item of data ?? []) if (item.path && item.signedUrl) next[item.path] = item.signedUrl;
          return next;
        });
      });
  }, [paths, urls]);

  async function savePaths(next: string[]) {
    const { error } = await db
      .from("treatments")
      .update({ xray_paths: next, xray_path: null })
      .eq("id", treatment.id);
    if (error) throw error;
    setPaths(next);
    onChanged();
  }

  async function upload(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    const tooBig = images.filter((f) => f.size > MAX_MB * 1024 * 1024);
    const ok = images.filter((f) => f.size <= MAX_MB * 1024 * 1024);
    const problems: string[] = [];
    if (images.length < files.length) problems.push("ზოგი ფაილი სურათი არ არის და გამოტოვდა");
    if (tooBig.length) problems.push(`${tooBig.length} ფაილი ${MAX_MB} MB-ზე დიდია და გამოტოვდა`);
    if (!ok.length) return setError(problems.join(". ") || "აირჩიეთ სურათი");

    setError(null);
    const uploaded: string[] = [];
    for (const [i, file] of ok.entries()) {
      setBusy(`იტვირთება ${i + 1}/${ok.length}...`);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${treatment.patient_id}/${treatment.id}-${Date.now()}-${i}.${ext}`;
      const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (error) problems.push(`${file.name}: ${error.message}`);
      else uploaded.push(path);
    }
    try {
      if (uploaded.length) await savePaths([...paths, ...uploaded]);
    } catch (e) {
      await db.storage.from(BUCKET).remove(uploaded);
      problems.push((e as Error).message);
    }
    setBusy(null);
    setError(problems.length ? problems.join(". ") : null);
  }

  async function removeCurrent() {
    if (viewing === null) return;
    const path = paths[viewing];
    setBusy("იშლება...");
    try {
      await savePaths(paths.filter((p) => p !== path));
      await db.storage.from(BUCKET).remove([path]);
      setViewing(paths.length > 1 ? Math.min(viewing, paths.length - 2) : null);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
    setConfirmDelete(false);
  }

  const current = viewing !== null ? paths[viewing] : null;

  return (
    <Modal title={`რენტგენი — ${treatment.procedure}`} onClose={onClose} wide>
      <p className="-mt-2 mb-4 text-sm text-slate-500">
        {formatDate(treatment.date)}
        {treatment.tooth_number ? ` · კბილი ${treatment.tooth_number}` : ""}
        {paths.length > 0 && ` · ${paths.length} სურათი`}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) upload(files);
        }}
      />

      {current !== null && viewing !== null ? (
        /* Large view of one image */
        <div>
          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
            {urls[current] ? (
              <a href={urls[current]} target="_blank" rel="noreferrer" title="სრულ ზომაზე გახსნა">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                <img src={urls[current]} alt="რენტგენი" className="max-h-[60vh] w-auto object-contain" />
              </a>
            ) : (
              <p className="text-sm text-slate-400">იტვირთება...</p>
            )}
            {paths.length > 1 && (
              <>
                <NavButton side="left" onClick={() => setViewing((viewing - 1 + paths.length) % paths.length)} />
                <NavButton side="right" onClick={() => setViewing((viewing + 1) % paths.length)} />
              </>
            )}
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white">
              {viewing + 1} / {paths.length}
            </span>
          </div>
          <div className="mt-3">
            <ErrorText error={error} />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {confirmDelete ? (
              <>
                <span className="mr-auto self-center text-sm text-red-600">წაიშალოს ეს სურათი?</span>
                <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                  არა
                </button>
                <button className="btn-danger" disabled={!!busy} onClick={removeCurrent}>
                  {busy ?? "დიახ, წაშლა"}
                </button>
              </>
            ) : (
              <>
                <button className="btn-secondary mr-auto" onClick={() => setViewing(null)}>
                  ← ყველა სურათი
                </button>
                <button className="btn-secondary text-red-600" onClick={() => setConfirmDelete(true)}>
                  წაშლა
                </button>
                {urls[current] && (
                  <a href={urls[current]} target="_blank" rel="noreferrer" className="btn-primary">
                    ⤢ სრულ ზომაზე
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* Gallery */
        <div>
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = [...(e.dataTransfer.files ?? [])];
              if (files.length) upload(files);
            }}
          >
            {paths.map((p, i) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setViewing(i);
                  setConfirmDelete(false);
                }}
                className="group relative aspect-square overflow-hidden rounded-lg bg-slate-900 ring-teal-500 transition hover:ring-2"
              >
                {urls[p] ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */
                  <img src={urls[p]} alt={`რენტგენი ${i + 1}`} className="h-full w-full object-cover opacity-90 group-hover:opacity-100" />
                ) : (
                  <span className="text-xs text-slate-400">...</span>
                )}
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={!!busy}
              onClick={() => fileRef.current?.click()}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 p-2 text-center text-slate-500 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 ${
                paths.length === 0 ? "col-span-2 aspect-auto min-h-48 sm:col-span-3" : ""
              }`}
            >
              <span className="text-3xl">{busy ? "⏳" : "🩻"}</span>
              <span className="text-sm font-medium">{busy ?? "+ სურათების დამატება"}</span>
              <span className="text-xs">რამდენიმე ერთად · ან ჩააგდეთ აქ · მაქს. {MAX_MB} MB</span>
            </button>
          </div>
          <div className="mt-3">
            <ErrorText error={error} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "წინა" : "შემდეგი"}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-1.5 text-xl text-white hover:bg-black/70 ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
