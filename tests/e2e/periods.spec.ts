import { expect, test } from "@playwright/test";
import type { Snapshot } from "../../lib/schema";
import { mockDesktop } from "./mock-desktop.mjs";

test.use({ timezoneId: "Europe/Paris" });

const cairo: Snapshot = {
  clients: [],
  projects: [
    {
      id: "project",
      name: "Projet fictif",
      color: "#7560db",
      clientId: null,
      archived: false,
    },
  ],
  entries: [
    {
      id: "night",
      description: "Nuit fictive du Caire",
      projectId: "project",
      clientId: null,
      start: "2026-04-23T21:00:00.000Z",
      end: "2026-04-24T23:00:00.000Z",
    },
    {
      id: "outside",
      description: "Hors période",
      projectId: "project",
      clientId: null,
      start: "2026-04-22T06:00:00.000Z",
      end: "2026-04-22T08:00:00.000Z",
    },
  ],
  timer: null,
  settings: { timezone: "Africa/Cairo", weeklyGoal: 35 },
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-04-24T09:00:00Z") });
  await mockDesktop(page, cairo);
  await page.goto("/");
  await expect(page.getByLabel("Tâche à chronométrer")).toBeVisible();
});

test("Le Caire : chargement, jour de 23 h, graphique et CSV bornés au 24 avril", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByLabel("Début de période", { exact: true }).fill("2026-04-24");
  await page.getByLabel("Fin de période", { exact: true }).fill("2026-04-24");
  await expect(page.locator(".activity-total strong")).toHaveText("23:00:00");
  await expect(page.getByText("Hors période", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Rapports", exact: true }).click();
  await expect(page.locator(".report-summary strong")).toHaveText("23 h");
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await page.getByRole("button", { name: "Exporter le rapport" }).click();
  const csv = await page.evaluate(
    () => (window as unknown as { lastCSV: string }).lastCSV,
  );
  expect(csv).toContain('"Africa/Cairo";"93600";"82800"');
  expect(csv).not.toContain("Hors période");
  expect(errors).toEqual([]);
});

test("une période vide ou inversée bloque l’export sans élargir les résultats", async ({
  page,
}) => {
  await page.getByLabel("Début de période", { exact: true }).fill("2026-04-25");
  await page.getByLabel("Fin de période", { exact: true }).fill("2026-04-24");
  await expect(page.locator(".inline-error")).toContainText(
    "La fin de période",
  );
  await expect(page.locator(".activity-total strong")).toHaveText("00:00:00");
  await expect(
    page.getByRole("button", { name: "Exporter la sélection en CSV" }),
  ).toBeDisabled();
  await page.getByLabel("Début de période", { exact: true }).fill("");
  await expect(page.locator(".inline-error")).toContainText(
    "Choisissez les deux dates",
  );
  await expect(
    page.getByLabel("Début de période", { exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Rapports", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Exporter le rapport" }),
  ).toBeDisabled();
});

test("le minuit inexistant reste refusé dans le formulaire", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Ajouter du temps" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Tâche", { exact: true })
    .fill("Saisie invalide fictive");
  await dialog.getByLabel("Début", { exact: true }).fill("2026-04-24T00:15");
  await dialog.getByLabel("Fin", { exact: true }).fill("2026-04-24T02:00");
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Cette heure est invalide",
  );
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("renderer-test") || "null"),
  );
  expect(state?.entries ?? cairo.entries).toHaveLength(2);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
