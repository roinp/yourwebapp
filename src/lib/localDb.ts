/* eslint-disable @typescript-eslint/no-explicit-any -- rows are untyped, like the Supabase client without generated types */
/**
 * Demo database kept in the browser's localStorage (X-ray images in IndexedDB).
 * It mimics the part of the Supabase query API this app uses, so pages call
 * `db.from("patients").select(...).eq(...)` exactly as they did with Supabase.
 */

type Row = Record<string, any>;
type DbError = { message: string; code?: string };
type Result<D> = { data: D; error: DbError | null; count: number | null };

const PREFIX = "yourwebapp:";

function load(table: string): Row[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PREFIX + table) ?? "[]");
  } catch {
    return [];
  }
}

function save(table: string, rows: Row[]) {
  localStorage.setItem(PREFIX + table, JSON.stringify(rows));
}

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

/** "9:30" / "09:30" → "09:30:00", like a Postgres `time` column. */
function normTime(v: any) {
  if (typeof v !== "string" || !/^\d{1,2}:\d{2}/.test(v)) return v;
  const [h, m, s = "00"] = v.split(":");
  return `${h.padStart(2, "0")}:${m}:${s}`;
}

/** Column defaults from the old Supabase schema. */
const DEFAULTS: Record<string, () => Row> = {
  doctors: () => ({ phone: null, specialty: null }),
  patients: () => ({ personal_id: null, phone: null, date_of_birth: null, notes: null }),
  appointments: () => ({ doctor_id: null, reason: null, notes: null }),
  treatments: () => ({
    doctor_id: null, date: today(), tooth_number: null, notes: null,
    price: 0, paid: 0, xray_path: null, xray_paths: [],
  }),
  expenses: () => ({
    date: today(), category: null, unit_price: 0, quantity: 1, supplier: null, paid: 0, notes: null,
  }),
  medical_cards: () => ({ data: {}, updated_at: now() }),
  medical_card_versions: () => ({ card_number: null, saved_at: now() }),
  calculations: () => ({ patient_name: null, discount: 0, rows: [], total: 0, updated_at: now() }),
  blocked_slots: () => ({}),
};

/** Embedded selects such as `patients(id, first_name)`: [foreign key, target table, one-to-many]. */
const RELATIONS: Record<string, Record<string, [string, string, boolean]>> = {
  appointments: { patients: ["patient_id", "patients", false], doctors: ["doctor_id", "doctors", false] },
  treatments: { doctors: ["doctor_id", "doctors", false] },
  patients: { appointments: ["patient_id", "appointments", true] },
};

/** Unique constraints: column lists that must not repeat. */
const UNIQUE: Record<string, string[][]> = {
  patients: [["personal_id"]],
  medical_cards: [["patient_id"]],
  blocked_slots: [["date", "time"]],
};

function prepare(table: string, row: Row): Row {
  const out = { ...row };
  if ("time" in out) out.time = normTime(out.time);
  return out;
}

function sameValue(col: string, a: any, b: any) {
  return col === "time" ? normTime(a) === normTime(b) : a === b;
}

function checkRow(table: string, row: Row, all: Row[]): DbError | null {
  for (const cols of UNIQUE[table] ?? []) {
    if (cols.some((c) => row[c] == null)) continue;
    const dup = all.find((r) => r.id !== row.id && cols.every((c) => sameValue(c, r[c], row[c])));
    if (dup) {
      return { code: "23505", message: `duplicate key value violates unique constraint "${table}_${cols.join("_")}_key"` };
    }
  }
  if (table === "appointments") {
    const blocked = load("blocked_slots").some((b) => b.date === row.date && sameValue("time", b.time, row.time));
    if (blocked) return { message: `${row.date} ${String(row.time).slice(0, 5)} დაბლოკილია, აირჩიეთ სხვა დრო` };
  }
  return null;
}

/** Deleting a patient removes their records; deleting a doctor clears the link. */
function cascade(table: string, removed: Row[]) {
  const ids = new Set(removed.map((r) => r.id));
  if (!ids.size) return;
  if (table === "patients") {
    for (const t of ["appointments", "treatments", "medical_cards", "medical_card_versions"]) {
      save(t, load(t).filter((r) => !ids.has(r.patient_id)));
    }
  }
  if (table === "doctors") {
    for (const t of ["appointments", "treatments"]) {
      save(t, load(t).map((r) => (ids.has(r.doctor_id) ? { ...r, doctor_id: null } : r)));
    }
  }
}

type Filter = { col: string; op: "eq" | "gt" | "gte" | "lt" | "lte" | "in"; value: any };
type Order = { col: string; ascending: boolean };

function matches(row: Row, f: Filter) {
  const v = f.col === "time" ? normTime(row[f.col]) : row[f.col];
  const target = f.col === "time" ? normTime(f.value) : f.value;
  switch (f.op) {
    case "eq": return v === target;
    case "gt": return v != null && v > target;
    case "gte": return v != null && v >= target;
    case "lt": return v != null && v < target;
    case "lte": return v != null && v <= target;
    case "in": return (target as any[]).includes(v);
  }
}

function sortRows(rows: Row[], orders: Order[]) {
  if (!orders.length) return rows;
  return [...rows].sort((a, b) => {
    for (const { col, ascending } of orders) {
      const x = a[col], y = b[col];
      if (x === y) continue;
      // Postgres puts nulls last when ascending, first when descending.
      if (x == null) return ascending ? 1 : -1;
      if (y == null) return ascending ? -1 : 1;
      return (x < y ? -1 : 1) * (ascending ? 1 : -1);
    }
    return 0;
  });
}

/** Splits "a, b(c, d), e" at top-level commas. */
function splitColumns(spec: string) {
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of spec) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

type Sub = { filters: Filter[]; orders: Order[]; limit: number | null };

function project(table: string, row: Row, spec: string, subs: Record<string, Sub>): Row {
  const cols = splitColumns(spec || "*");
  const out: Row = {};
  for (const col of cols) {
    const embed = col.match(/^(\w+)\(([\s\S]*)\)$/);
    if (!embed) {
      if (col === "*") Object.assign(out, row);
      else out[col] = row[col] ?? null;
      continue;
    }
    const [, name, inner] = embed;
    const rel = RELATIONS[table]?.[name];
    if (!rel) continue;
    const [fk, target, many] = rel;
    if (many) {
      const sub = subs[name] ?? { filters: [], orders: [], limit: null };
      let list = load(target).filter((r) => r[fk] === row.id && sub.filters.every((f) => matches(r, f)));
      list = sortRows(list, sub.orders);
      if (sub.limit != null) list = list.slice(0, sub.limit);
      out[name] = list.map((r) => project(target, r, inner, {}));
    } else {
      const found = row[fk] == null ? null : load(target).find((r) => r.id === row[fk]);
      out[name] = found ? project(target, found, inner, {}) : null;
    }
  }
  return out;
}

// D is `any[]` for lists and `any` after .single(), matching the untyped Supabase client.
class Query<D = any[]> implements PromiseLike<Result<D>> {
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private columns: string | null = null;
  private countMode = false;
  private head = false;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitN: number | null = null;
  private subs: Record<string, Sub> = {};
  private mode: "many" | "single" | "maybeSingle" = "many";

  constructor(private table: string) {}

  private sub(name: string) {
    return (this.subs[name] ??= { filters: [], orders: [], limit: null });
  }

  select(columns = "*", opts: { count?: string; head?: boolean } = {}) {
    this.columns = columns;
    this.countMode = !!opts.count;
    this.head = !!opts.head;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.action = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.action = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.upsertOpts = opts;
    return this;
  }
  update(patch: Row) {
    this.action = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }

  private filter(col: string, op: Filter["op"], value: any) {
    const dot = col.indexOf(".");
    if (dot > 0) this.sub(col.slice(0, dot)).filters.push({ col: col.slice(dot + 1), op, value });
    else this.filters.push({ col, op, value });
    return this;
  }
  eq(col: string, value: any) { return this.filter(col, "eq", value); }
  gt(col: string, value: any) { return this.filter(col, "gt", value); }
  gte(col: string, value: any) { return this.filter(col, "gte", value); }
  lt(col: string, value: any) { return this.filter(col, "lt", value); }
  lte(col: string, value: any) { return this.filter(col, "lte", value); }
  in(col: string, values: any[]) { return this.filter(col, "in", values); }

  order(col: string, opts: { ascending?: boolean; referencedTable?: string } = {}) {
    const o = { col, ascending: opts.ascending ?? true };
    if (opts.referencedTable) this.sub(opts.referencedTable).orders.push(o);
    else this.orders.push(o);
    return this;
  }
  limit(n: number, opts: { referencedTable?: string } = {}) {
    if (opts.referencedTable) this.sub(opts.referencedTable).limit = n;
    else this.limitN = n;
    return this;
  }
  single(): Query<any> {
    this.mode = "single";
    return this;
  }
  maybeSingle(): Query<any> {
    this.mode = "maybeSingle";
    return this;
  }

  then<A = Result<D>, B = never>(
    onFulfilled?: ((value: Result<D>) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: any) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onFulfilled, onRejected);
  }

  private run(): Result<any> {
    const all = load(this.table);
    let affected: Row[];

    switch (this.action) {
      case "select": {
        affected = sortRows(all.filter((r) => this.filters.every((f) => matches(r, f))), this.orders);
        const count = affected.length;
        if (this.limitN != null) affected = affected.slice(0, this.limitN);
        if (this.head) return { data: null, error: null, count };
        return this.finish(affected, this.countMode ? count : null);
      }
      case "insert":
      case "upsert": {
        const conflictCols = this.upsertOpts.onConflict?.split(",").map((c) => c.trim());
        const rows = [...all];
        affected = [];
        for (const input of this.payload) {
          const values = prepare(this.table, input);
          const existing = conflictCols
            ? rows.findIndex((r) => conflictCols.every((c) => sameValue(c, r[c], values[c])))
            : -1;
          if (existing >= 0) {
            if (this.upsertOpts.ignoreDuplicates) continue;
            const updated: Row = { ...rows[existing], ...values, id: rows[existing].id };
            const err = checkRow(this.table, updated, rows);
            if (err) return { data: null, error: err, count: null };
            rows[existing] = updated;
            affected.push(updated);
            continue;
          }
          const row: Row = { id: crypto.randomUUID(), created_at: now(), ...DEFAULTS[this.table]?.(), ...values };
          if (this.table === "medical_cards") {
            row.card_number = Math.max(0, ...rows.map((r) => Number(r.card_number) || 0)) + 1;
          }
          const err = checkRow(this.table, row, rows);
          if (err) return { data: null, error: err, count: null };
          rows.push(row);
          affected.push(row);
        }
        save(this.table, rows);
        break;
      }
      case "update": {
        const values = prepare(this.table, this.patch);
        const rows = [...all];
        affected = [];
        for (const [i, r] of rows.entries()) {
          if (!this.filters.every((f) => matches(r, f))) continue;
          const updated: Row = { ...r, ...values, id: r.id };
          // Like the old database trigger, only a changed date/time is checked against blocked slots.
          const moved = updated.date !== r.date || !sameValue("time", updated.time, r.time);
          const err = checkRow(this.table === "appointments" && !moved ? "" : this.table, updated, rows);
          if (err) return { data: null, error: err, count: null };
          rows[i] = updated;
          affected.push(updated);
        }
        save(this.table, rows);
        break;
      }
      case "delete": {
        affected = all.filter((r) => this.filters.every((f) => matches(r, f)));
        const gone = new Set(affected);
        save(this.table, all.filter((r) => !gone.has(r)));
        cascade(this.table, affected);
        break;
      }
    }
    // Writes return rows only when followed by .select(), as in Supabase.
    return this.columns === null ? { data: null, error: null, count: null } : this.finish(affected, null);
  }

  private finish(rows: Row[], count: number | null): Result<any> {
    const data = rows.map((r) => project(this.table, r, this.columns ?? "*", this.subs));
    if (this.mode === "many") return { data, error: null, count };
    if (data.length > 1) return { data: null, error: { message: "მოიძებნა ერთზე მეტი ჩანაწერი" }, count };
    if (!data.length && this.mode === "single") {
      return { data: null, error: { message: "ჩანაწერი ვერ მოიძებნა" }, count };
    }
    return { data: data[0] ?? null, error: null, count };
  }
}

// ===== X-ray images (IndexedDB, since localStorage is too small for pictures) =====

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("yourwebapp-files", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function files<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const conn = await idb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = conn.transaction("files", mode);
    const req = fn(tx.objectStore("files"));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

function bucket(name: string) {
  const key = (path: string) => `${name}/${path}`;
  return {
    // Upload options and URL lifetimes from the Supabase API are accepted but not needed here.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async upload(path: string, file: Blob, opts?: unknown) {
      try {
        await files("readwrite", (s) => s.put(file, key(path)));
        return { data: { path }, error: null as DbError | null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
    async remove(paths: string[]) {
      await files("readwrite", (s) => {
        for (const p of paths) s.delete(key(p));
      });
      return { data: null, error: null };
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async createSignedUrls(paths: string[], expiresIn?: number) {
      const data: { path: string; signedUrl: string | null; error: string | null }[] = [];
      for (const path of paths) {
        const blob = await files<Blob>("readonly", (s) => s.get(key(path)));
        data.push({ path, signedUrl: blob ? URL.createObjectURL(blob) : null, error: blob ? null : "not found" });
      }
      return { data, error: null as DbError | null };
    },
  };
}

export const db = {
  from: (table: string) => new Query(table),
  storage: { from: bucket },
};
