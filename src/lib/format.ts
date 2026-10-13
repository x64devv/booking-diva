// Formatting is done by hand (not Intl) so server and browser always produce identical text —
// ICU builds differ (e.g. "Sun 18" vs "Sun, 18"), which breaks React hydration.
// Zimbabwe is UTC+2 all year (no daylight saving).
const OFFSET_MS = 2 * 3600_000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SYMBOLS: Record<string, string> = { USD: "$", ZWG: "ZiG ", ZAR: "R", GBP: "£", EUR: "€" };

export function money(amount: number | string | null | undefined, currency = "USD") {
  const n = Number(amount ?? 0);
  const [whole, cents] = Math.abs(n).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}${SYMBOLS[currency] ?? currency + " "}${grouped}.${cents}`;
}

/** Calendar parts in Harare time. Plain YYYY-MM-DD values are treated as calendar days. */
function parts(value: string) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(new Date(value).getTime() + OFFSET_MS);
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), wd: d.getUTCDay(),
    hh: String(d.getUTCHours()).padStart(2, "0"), mm: String(d.getUTCMinutes()).padStart(2, "0"),
  };
}

export function dateLong(value: string | null | undefined) {
  if (!value) return "—";
  const p = parts(value);
  return `${DAYS[p.wd]} ${p.day} ${MONTHS[p.m]} ${p.y}`;
}

export function dateRange(start: string, end: string) {
  const s = parts(start);
  const e = parts(end);
  if (start === end) return `${s.day} ${MONTHS[s.m]} ${s.y}`;
  if (s.m === e.m && s.y === e.y) return `${s.day}–${e.day} ${MONTHS[s.m]} ${s.y}`;
  return `${s.day} ${MONTHS[s.m]} – ${e.day} ${MONTHS[e.m]} ${e.y}`;
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const p = parts(value);
  return `${p.day} ${MONTHS[p.m].slice(0, 3)} ${p.y}, ${p.hh}:${p.mm}`;
}

export function shortDay(value: string) {
  const p = parts(value);
  return `${p.day} ${MONTHS[p.m].slice(0, 3)}`;
}

/** Value for <input type="datetime-local"> in Harare time (UTC+2, no DST). */
export function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(new Date(value).getTime() + OFFSET_MS);
  return d.toISOString().slice(0, 16);
}

/** Parse a datetime-local value entered in Harare time. */
export function fromLocalInput(value: string) {
  if (!value) return null;
  return new Date(`${value}:00+02:00`).toISOString();
}

export function phoneDisplay(p: string) {
  const m = /^\+263(\d{2})(\d{3})(\d{4})$/.exec(p);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : p;
}
