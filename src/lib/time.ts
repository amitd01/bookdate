/** Date helpers for chat timestamps, in the device's locale. */

/** Postgres sends microseconds; trim to milliseconds so every JS engine parses it. */
export const toMs = (iso: string) => new Date(iso.replace(/(\.\d{3})\d+/, '$1')).getTime();

const DAY = 86_400_000;
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysAgo = (iso: string) => Math.round((startOfDay(Date.now()) - startOfDay(toMs(iso))) / DAY);

export const formatTime = (iso: string) => new Date(toMs(iso)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Match list: "9:41" today, "Tue" this week, "8 Oct" before that. */
export function formatWhen(iso: string) {
  const n = daysAgo(iso);
  const d = new Date(toMs(iso));
  if (n === 0) return formatTime(iso);
  if (n < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Chat day separators: "Today", "Yesterday", "Tuesday 8 October". */
export function formatDay(iso: string) {
  const n = daysAgo(iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  return new Date(toMs(iso)).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export const sameDay = (a: string, b: string) => startOfDay(toMs(a)) === startOfDay(toMs(b));
