import { describe, expect, it } from "vitest";
import {
  clipSeconds,
  csvCell,
  dateKey,
  duration,
  localInput,
  localToISO,
  nextDay,
  secondsBetween,
  startOfDay,
} from "../lib/time";

describe("Calculs et fuseaux", () => {
  it("convertit une heure de Tahiti indépendamment du fuseau de la machine", () => {
    expect(localToISO("2026-10-15T09:30", "Pacific/Tahiti")).toBe(
      "2026-10-15T19:30:00.000Z",
    );
    expect(localInput("2026-10-15T19:30:42.000Z", "Pacific/Tahiti", true)).toBe(
      "2026-10-15T09:30:42",
    );
    expect(localToISO("2026-10-15T09:30:42", "Pacific/Tahiti")).toBe(
      "2026-10-15T19:30:42.000Z",
    );
    expect(dateKey("2026-10-16T01:00:00Z", "Pacific/Tahiti")).toBe(
      "2026-10-15",
    );
  });
  it("rejette les heures inexistantes et les dates invalides", () => {
    expect(() => localToISO("2026-03-29T02:30", "Europe/Paris")).toThrow();
    expect(() => localToISO("2026-02-30T09:30", "Pacific/Tahiti")).toThrow();
    expect(() => localToISO("2026-10-25T02:30", "Europe/Paris")).toThrow(
      "deux fois",
    );
  });
  it("mesure la durée réelle lors du passage à l’heure d’été", () => {
    expect(
      secondsBetween(
        localToISO("2026-03-29T01:30", "Europe/Paris"),
        localToISO("2026-03-29T03:30", "Europe/Paris"),
      ),
    ).toBe(3600);
  });
  it("répartit un créneau passant minuit entre deux jours sans double comptage", () => {
    const zone = "Pacific/Tahiti";
    const start = localToISO("2026-10-15T23:00", zone);
    const end = localToISO("2026-10-16T02:00", zone);
    const first = clipSeconds(
      start,
      end,
      localToISO("2026-10-15T00:00", zone),
      localToISO("2026-10-16T00:00", zone),
    );
    const second = clipSeconds(
      start,
      end,
      localToISO("2026-10-16T00:00", zone),
      localToISO("2026-10-17T00:00", zone),
    );
    expect(first).toBe(3600);
    expect(second).toBe(7200);
    expect(first + second).toBe(secondsBetween(start, end));
  });
  it("conserve les durées supérieures à une journée et les frontières de mois", () => {
    expect(duration(90061)).toBe("25:01:01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
  it("neutralise les formules dans les exports CSV", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("hello;world")).toBe('"hello;world"');
  });

  it("commence la journée du Caire à son premier instant même sans minuit", () => {
    const start = startOfDay("2026-04-24", "Africa/Cairo");
    const end = startOfDay("2026-04-25", "Africa/Cairo");
    expect(start).toBe("2026-04-23T22:00:00.000Z");
    expect(localInput(start, "Africa/Cairo")).toBe("2026-04-24T01:00");
    expect(end).toBe("2026-04-24T21:00:00.000Z");
    expect(secondsBetween(start, end)).toBe(23 * 3600);
    expect(() => localToISO("2026-04-24T00:00", "Africa/Cairo")).toThrow();
  });

  it.each([
    ["Pacific/Tahiti", "2026-04-24", "2026-04-24T10:00:00.000Z", 24],
    ["Europe/Paris", "2026-03-29", "2026-03-28T23:00:00.000Z", 23],
    ["Europe/Paris", "2026-10-25", "2026-10-24T22:00:00.000Z", 25],
    ["Africa/Cairo", "2026-10-29", "2026-10-28T21:00:00.000Z", 25],
    ["America/Havana", "2026-11-01", "2026-11-01T04:00:00.000Z", 25],
  ])(
    "respecte les limites de journée de %s le %s",
    (zone, day, start, hours) => {
      expect(startOfDay(day, zone)).toBe(start);
      expect(secondsBetween(start, startOfDay(nextDay(day), zone))).toBe(
        hours * 3600,
      );
    },
  );

  it("utilise le premier minuit répété sans autoriser sa saisie ambiguë", () => {
    expect(startOfDay("2026-11-01", "America/Havana")).toBe(
      "2026-11-01T04:00:00.000Z",
    );
    expect(() => localToISO("2026-11-01T00:30", "America/Havana")).toThrow(
      "deux fois",
    );
  });

  it("trouve le premier minuit même si une transition revient au jour précédent", () => {
    expect(startOfDay("2010-03-05", "Antarctica/Casey")).toBe(
      "2010-03-04T13:00:00.000Z",
    );
  });

  it("représente une date entièrement sautée par une journée vide", () => {
    expect(startOfDay("2011-12-30", "Pacific/Apia")).toBe(
      startOfDay("2011-12-31", "Pacific/Apia"),
    );
  });

  it.each(["", "2026-02-30", "2026-4-24", "not-a-date"])(
    "refuse une date de journée invalide : %s",
    (day) => expect(() => startOfDay(day, "Africa/Cairo")).toThrow(),
  );
});
