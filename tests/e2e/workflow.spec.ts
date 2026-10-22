import { mockDesktop } from "./mock-desktop.mjs";
import { test, expect } from "@playwright/test";
test("interface bureau : parcours avec communication Tauri simulée", async ({
  page,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (req) => {
    if (!req.url().startsWith("http://127.0.0.1:3101"))
      external.push(req.url());
  });
  await mockDesktop(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "créez votre premier projet" })
    .click();
  await page.getByLabel("Nom du projet").fill("Projet de validation");
  await page.getByRole("button", { name: "Enregistrer le projet" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Tâche à chronométrer").fill("Travail chronométré");
  await page
    .getByLabel("Projet du chronomètre")
    .selectOption({ label: "Projet de validation" });
  await page.getByRole("button", { name: "Démarrer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Arrêter", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Tâche à chronométrer")).toHaveValue(
    "Travail chronométré",
  );
  await page.getByRole("button", { name: "Arrêter", exact: true }).click();
  await expect(
    page.getByText("Temps enregistré.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ajouter du temps" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Tâche", { exact: true })
    .fill("Créneau de nuit");
  await page.getByLabel("Début", { exact: true }).fill("2026-01-05T23:00");
  await page.getByLabel("Fin", { exact: true }).fill("2026-01-06T02:00");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Tout", exact: true }).click();
  await expect(
    page.getByText("Créneau de nuit", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rapports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Votre rythme de travail" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exporter le rapport" }).click();
  await expect(page.getByText("Export CSV enregistré.")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { lastCSV: string }).lastCSV,
    ),
  ).toContain("Créneau de nuit");
  await page.getByRole("button", { name: "Calendrier", exact: true }).click();
  await expect(page.locator(".fc")).toBeVisible();
  await page.getByRole("button", { name: "Mois", exact: true }).click();
  await page
    .getByRole("button", { name: "Projets & clients", exact: true })
    .click();
  await page.getByRole("button", { name: "Nouveau client" }).click();
  await page.getByLabel("Nom du client").fill("Client de validation");
  await page.getByRole("button", { name: "Enregistrer le client" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await page.getByLabel("Objectif hebdomadaire (heures)").fill("30");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Préférences enregistrées.")).toBeVisible();
  await page
    .getByRole("button", { name: "Enregistrer une sauvegarde complète" })
    .click();
  await expect(page.getByText("Sauvegarde enregistrée.")).toBeVisible();
  await page
    .getByRole("button", { name: "Choisir un fichier de sauvegarde" })
    .click();
  await expect(page.getByText("Sauvegarde restaurée.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Suivi du temps", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/timecord-desktop-tauri.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("une simple page web ne peut pas accéder aux données natives", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".alert.error")).toContainText(
    "Ouvrez Timecord depuis l’application Windows",
  );
});
