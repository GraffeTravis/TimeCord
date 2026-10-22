import type { Client, Entry, Project } from "./schema";
import {
  clipSeconds,
  csvCell,
  localInput,
  nextDay,
  niceDay,
  secondsBetween,
  startOfDay,
} from "./time";

export type PeriodBounds = { start: string; end: string };
export type ChartPoint = { name: string; heures: number; période: string };

export function selectPeriod(
  from: string,
  to: string,
  zone: string,
): {
  bounds: PeriodBounds | null;
  error: string;
} {
  if (!from || !to)
    return { bounds: null, error: "Choisissez les deux dates de la période." };
  if (from > to)
    return {
      bounds: null,
      error: "La fin de période doit être après le début.",
    };
  try {
    // Validate both dates before advancing the inclusive end date.
    const start = startOfDay(from, zone);
    startOfDay(to, zone);
    return { bounds: { start, end: startOfDay(nextDay(to), zone) }, error: "" };
  } catch (error) {
    return {
      bounds: null,
      error: error instanceof Error ? error.message : "Période invalide.",
    };
  }
}

export function sumPeriod(entries: Entry[], bounds: PeriodBounds | null) {
  if (!bounds) return 0;
  return entries.reduce(
    (sum, e) => sum + clipSeconds(e.start, e.end, bounds.start, bounds.end),
    0,
  );
}

export function dailyChart(
  entries: Entry[],
  from: string,
  to: string,
  zone: string,
): ChartPoint[] {
  if (!selectPeriod(from, to, zone).bounds) return [];
  const count =
    Math.round(
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86400000,
    ) + 1;
  const stride = count > 62 ? Math.ceil(count / 31) : 1;
  const result: ChartPoint[] = [];
  for (let index = 0; index < count && index < 36600; index += stride) {
    const day = nextDay(from, index);
    const endDay = nextDay(from, Math.min(index + stride, count));
    const seconds = sumPeriod(entries, {
      start: startOfDay(day, zone),
      end: startOfDay(endDay, zone),
    });
    result.push({
      name: `${day.slice(8)}/${day.slice(5, 7)}`,
      heures: Number((seconds / 3600).toFixed(3)),
      période:
        stride > 1
          ? `${niceDay(day)} → ${niceDay(nextDay(endDay, -1))}`
          : niceDay(day),
    });
  }
  return result;
}

export function reportCSV(
  entries: Entry[],
  projects: Record<string, Project>,
  clients: Record<string, Client>,
  zone: string,
  bounds: PeriodBounds,
) {
  const rows = [
    [
      "Tâche",
      "Projet",
      "Client",
      "Début",
      "Fin",
      "Fuseau",
      "Durée complète (secondes)",
      "Durée dans la période (secondes)",
    ],
    ...entries.map((e) => [
      e.description,
      projects[e.projectId]?.name,
      e.clientId ? clients[e.clientId]?.name : "",
      localInput(e.start, zone, true),
      localInput(e.end, zone, true),
      zone,
      secondsBetween(e.start, e.end),
      clipSeconds(e.start, e.end, bounds.start, bounds.end),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
