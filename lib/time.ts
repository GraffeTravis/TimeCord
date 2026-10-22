export const DEFAULT_ZONE = "Pacific/Tahiti";
export function validZone(zone: string) {
  try {
    new Intl.DateTimeFormat("fr", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
export function dateKey(value: string | number | Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}
export function localInput(
  value: string | number,
  zone: string,
  withSeconds = false,
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}${withSeconds ? `:${get("second")}` : ""}`;
}
export function localToISO(value: string, zone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))
    throw new Error("Date ou heure invalide.");
  const [year, month, day, hour, minute, second = 0] = value
    .split(/[-T:]/)
    .map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const actual = localInput(guess, zone, value.length > 16);
    const [y, m, d, h, min, sec = 0] = actual.split(/[-T:]/).map(Number);
    const difference = target - Date.UTC(y, m - 1, d, h, min, sec);
    if (!difference && actual === value) {
      // An autumn clock change can map one wall time to two instants. Require an unambiguous time.
      for (const delta of [
        -7200000, -3600000, -1800000, 1800000, 3600000, 7200000,
      ]) {
        if (localInput(guess + delta, zone, value.length > 16) === value)
          throw new Error(
            "Cette heure existe deux fois lors du changement d’heure. Choisissez un horaire non ambigu.",
          );
      }
      return new Date(guess).toISOString();
    }
    guess += difference;
  }
  throw new Error(
    "Cette heure est invalide dans le fuseau choisi (changement d’heure éventuel).",
  );
}
export function nextDay(day: string, amount = 1) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
/**
 * First instant of a civil day, for report boundaries only. A repeated midnight
 * uses its first occurrence; a missing midnight uses the clock transition.
 * A skipped date has the same boundary as the following date (an empty day).
 * User-entered wall times must still go through the strict localToISO validator.
 */
export function startOfDay(day: string, zone: string): string {
  const target = Date.parse(`${day}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(target) ||
    new Date(target).toISOString().slice(0, 10) !== day
  )
    throw new Error("Date de journée invalide.");

  // Sample the offsets on both sides of the date. This also finds the earliest
  // midnight when a backward transition crosses the civil-date boundary.
  const midnight = `${day}T00:00:00`;
  const candidates = new Set<number>();
  const hour = 3600000;
  for (let delta = -36; delta <= 36; delta += 12) {
    const instant = target + delta * hour;
    const wallTime = Date.parse(`${localInput(instant, zone, true)}Z`);
    const candidate = target - (wallTime - instant);
    if (localInput(candidate, zone, true) === midnight)
      candidates.add(candidate);
  }
  if (candidates.size) return new Date(Math.min(...candidates)).toISOString();

  // No midnight exists. Locate the transition at millisecond precision rather
  // than inventing a time such as 01:00 or broadening the requested period.
  let before = target - 36 * hour;
  let after = target + 36 * hour;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (dateKey(middle, zone) < day) before = middle;
    else after = middle;
  }
  return new Date(after).toISOString();
}

export function monday(day: string) {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return nextDay(day, -(dow === 0 ? 6 : dow - 1));
}

export function niceDay(day: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
export function duration(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(n / 3600)).padStart(2, "0")}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function hours(seconds: number) {
  return `${(seconds / 3600).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}
export function secondsBetween(start: string, end: string) {
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000);
}
export function clipSeconds(
  start: string,
  end: string,
  from: string,
  to: string,
) {
  return Math.max(
    0,
    (Math.min(Date.parse(end), Date.parse(to)) -
      Math.max(Date.parse(start), Date.parse(from))) /
      1000,
  );
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
