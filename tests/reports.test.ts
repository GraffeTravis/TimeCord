import { describe, expect, it } from "vitest";
import { dailyChart, reportCSV, selectPeriod, sumPeriod } from "../lib/reports";
import type { Entry, Project } from "../lib/schema";
import { localToISO } from "../lib/time";

const project: Project = {
  id: "project",
  name: "Projet fictif",
  color: "#7560db",
  clientId: null,
  archived: false,
};
function entry(start: string, end: string, zone: string): Entry {
  return {
    id: "entry",
    description: "Créneau fictif",
    projectId: project.id,
    clientId: null,
    start: localToISO(start, zone),
    end: localToISO(end, zone),
  };
}

describe("Périodes et exports", () => {
  it("limite le rapport du Caire au 24 avril et conserve la durée complète dans le CSV", () => {
    const zone = "Africa/Cairo";
    const entries = [entry("2026-04-23T23:00", "2026-04-25T02:00", zone)];
    const { bounds, error } = selectPeriod("2026-04-24", "2026-04-24", zone);
    expect(error).toBe("");
    expect(bounds).toEqual({
      start: "2026-04-23T22:00:00.000Z",
      end: "2026-04-24T21:00:00.000Z",
    });
    expect(sumPeriod(entries, bounds)).toBe(23 * 3600);
    expect(
      dailyChart(entries, "2026-04-24", "2026-04-24", zone)[0].heures,
    ).toBe(23);
    expect(reportCSV(entries, { project }, {}, zone, bounds!)).toContain(
      '"2026-04-23T23:00:00";"2026-04-25T02:00:00";"Africa/Cairo";"93600";"82800"',
    );
  });

  it.each(["Pacific/Tahiti", "Europe/Paris", "Africa/Cairo"])(
    "répartit une entrée de nuit sans double comptage dans %s",
    (zone) => {
      const entries = [entry("2026-04-23T23:00", "2026-04-24T02:00", zone)];
      const first = sumPeriod(
        entries,
        selectPeriod("2026-04-23", "2026-04-23", zone).bounds,
      );
      const second = sumPeriod(
        entries,
        selectPeriod("2026-04-24", "2026-04-24", zone).bounds,
      );
      const total = sumPeriod(
        entries,
        selectPeriod("2026-04-23", "2026-04-24", zone).bounds,
      );
      expect(first).toBe(3600);
      expect(second).toBe(zone === "Africa/Cairo" ? 3600 : 7200);
      expect(first + second).toBe(total);
      expect(
        dailyChart(entries, "2026-04-23", "2026-04-24", zone).map(
          (p) => p.heures,
        ),
      ).toEqual([1, second / 3600]);
    },
  );

  it.each([
    ["2026-03-29", "2026-03-29T00:00", "2026-03-30T00:00", 23],
    ["2026-10-25", "2026-10-25T00:00", "2026-10-26T00:00", 25],
  ])(
    "exporte la durée réelle de la journée de Paris du %s",
    (day, start, end, hours) => {
      const zone = "Europe/Paris";
      const entries = [entry(start, end, zone)];
      const bounds = selectPeriod(day, day, zone).bounds!;
      expect(sumPeriod(entries, bounds)).toBe(hours * 3600);
      expect(reportCSV(entries, { project }, {}, zone, bounds)).toContain(
        `"${hours * 3600}";"${hours * 3600}"`,
      );
    },
  );

  it.each([
    ["", "2026-04-24"],
    ["2026-04-24", ""],
    ["2026-04-25", "2026-04-24"],
    ["2026-02-30", "2026-04-24"],
    ["2026-04-24", "2026-04-31"],
  ])("n’invente aucune période de repli pour %s → %s", (from, to) => {
    const result = selectPeriod(from, to, "Africa/Cairo");
    expect(result.bounds).toBeNull();
    expect(result.error).not.toBe("");
    expect(sumPeriod([], result.bounds)).toBe(0);
    expect(dailyChart([], from, to, "Africa/Cairo")).toEqual([]);
  });

  it("conserve le BOM, le séparateur, les secondes et la protection des formules CSV", () => {
    const task = {
      ...entry("2026-10-15T23:00:42", "2026-10-16T02:00:42", "Pacific/Tahiti"),
      description: '=SUM(1;2) "test"',
    };
    const bounds = selectPeriod(
      "2026-10-16",
      "2026-10-16",
      "Pacific/Tahiti",
    ).bounds!;
    const csv = reportCSV([task], { project }, {}, "Pacific/Tahiti", bounds);
    expect(csv.startsWith('\uFEFF"Tâche";')).toBe(true);
    expect(csv).toContain('\r\n"\'=SUM(1;2) ""test""";');
    expect(csv).toContain(
      '"2026-10-15T23:00:42";"2026-10-16T02:00:42";"Pacific/Tahiti";"10800";"7242"',
    );
  });

  it("agrège les longues périodes sans perdre la dernière journée", () => {
    const entries = [
      entry("2026-01-01T09:00", "2026-01-01T10:00", "Pacific/Tahiti"),
      entry("2026-12-31T09:00", "2026-12-31T11:00", "Pacific/Tahiti"),
    ];
    const chart = dailyChart(
      entries,
      "2026-01-01",
      "2026-12-31",
      "Pacific/Tahiti",
    );
    expect(chart.length).toBeLessThanOrEqual(31);
    expect(chart.reduce((sum, point) => sum + point.heures, 0)).toBe(3);
  });
});
