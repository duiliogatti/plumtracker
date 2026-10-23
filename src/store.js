// Capa de datos: Supabase si hay credenciales, si no un modo demo guardado en este navegador.
import { createClient } from "@supabase/supabase-js";
import seed from "./seed.json";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const demo = !URL || !KEY;

const TASK_COLS = { start: "start_date", due: "due_date" };
const GUEST_COLS = { arrDate: "arr_date", arrTime: "arr_time", depDate: "dep_date", depTime: "dep_time" };

function toRow(obj, cols) {
  const row = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "id" || k === "updatedAt" || k === "updatedBy") continue;
    const col = cols[k] || k;
    row[col] = col.endsWith("_date") ? v || null : v;
  }
  return row;
}
function fromRow(row, cols) {
  const back = Object.fromEntries(Object.entries(cols).map(([k, c]) => [c, k]));
  const obj = {};
  for (const [c, v] of Object.entries(row)) {
    if (c === "updated_at") obj.updatedAt = v;
    else if (c === "updated_by") obj.updatedBy = v;
    else if (c === "created_at") continue;
    else obj[back[c] || c] = v ?? "";
  }
  return obj;
}

/* ---------- Supabase ---------- */
const sb = demo ? null : createClient(URL, KEY);

const remote = {
  async session() {
    const { data } = await sb.auth.getSession();
    return data.session ? { email: data.session.user.email } : null;
  },
  onAuth(cb) {
    sb.auth.onAuthStateChange((_e, s) => cb(s ? { email: s.user.email } : null));
  },
  async signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async setPassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
  },
  async signOut() {
    await sb.auth.signOut();
  },
  subscribe(onData, onError) {
    const state = { tasks: [], guests: [] };
    const load = async (table) => {
      const { data, error } = await sb.from(table).select("*").order("created_at");
      if (error) return onError(error);
      state[table] = data.map((r) => fromRow(r, table === "tasks" ? TASK_COLS : GUEST_COLS));
      onData({ ...state });
    };
    load("tasks");
    load("guests");
    const ch = sb
      .channel("plum")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => load("tasks"))
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, () => load("guests"))
      .subscribe();
    // Al volver a la app (celular en segundo plano), refrescar por si se perdió algún cambio.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) { load("tasks"); load("guests"); }
    });
    return () => sb.removeChannel(ch);
  },
  async save(table, id, data) {
    const row = toRow(data, table === "tasks" ? TASK_COLS : GUEST_COLS);
    const q = id ? sb.from(table).update(row).eq("id", id) : sb.from(table).insert(row);
    const { error } = await q;
    if (error) throw error;
  },
  async remove(table, id) {
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) throw error;
  },
};

/* ---------- Demo (localStorage) ---------- */
const KEY_DEMO = "plum.demo.v1";
let listeners = [];
function readDemo() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_DEMO));
    if (s && s.tasks) return s;
  } catch (e) {}
  const s = { tasks: seed.map((t, i) => ({ id: "seed" + i, ...t })), guests: [] };
  writeDemo(s);
  return s;
}
function writeDemo(s) {
  try { localStorage.setItem(KEY_DEMO, JSON.stringify(s)); } catch (e) {}
  listeners.forEach((fn) => fn({ ...s }));
}
const local = {
  async session() { return { email: "modo demo" }; },
  onAuth() {},
  async signIn() {},
  async setPassword() {},
  async signOut() {},
  subscribe(onData) {
    listeners.push(onData);
    onData({ ...readDemo() });
    return () => (listeners = listeners.filter((f) => f !== onData));
  },
  async save(table, id, data) {
    const s = readDemo();
    const row = { ...data, updatedAt: new Date().toISOString(), updatedBy: "modo demo" };
    if (id) s[table] = s[table].map((x) => (x.id === id ? { ...row, id } : x));
    else s[table] = [...s[table], { ...row, id: Math.random().toString(36).slice(2) }];
    writeDemo(s);
  },
  async remove(table, id) {
    const s = readDemo();
    s[table] = s[table].filter((x) => x.id !== id);
    writeDemo(s);
  },
};

export const store = demo ? local : remote;
