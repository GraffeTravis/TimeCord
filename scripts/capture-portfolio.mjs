// Browser renderer only. Uses synthetic fixtures and never invokes native Tauri.
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { mockDesktop } from "../tests/e2e/mock-desktop.mts";

const snapshot = JSON.parse(
  await readFile(
    new URL("../tests/fixtures/portfolio.json", import.meta.url),
    "utf8",
  ),
);
const server = spawn(process.execPath, ["scripts/serve-preview.mjs"], {
  windowsHide: true,
  stdio: "ignore",
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error(
        "Le serveur de captures n’a pas démarré. Vérifiez que le port 3101 est libre.",
      );
    try {
      ready = (await fetch("http://127.0.0.1:3101")).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready)
    throw new Error("Construisez d’abord le frontend avec npm run build.");
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "UTC",
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-10-21T21:30:00Z") });
  await mockDesktop(page, snapshot);
  await page.goto("http://127.0.0.1:3101");
  await page.getByText("Ajustements responsive", { exact: true }).waitFor();
  await mkdir("docs/images", { recursive: true });
  await page.screenshot({
    path: "docs/images/tracking.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Rapports", exact: true }).click();
  await page.locator(".recharts-wrapper").waitFor();
  // Finish the chart's JavaScript animation before capturing the bars.
  await page.clock.runFor(2000);
  await page.screenshot({
    path: "docs/images/reports.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Calendrier", exact: true }).click();
  await page.locator(".fc").waitFor();
  await page.screenshot({
    path: "docs/images/calendar.png",
    fullPage: true,
    animations: "disabled",
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Trois captures générées dans docs/images avec les seules données fictives de tests/fixtures/portfolio.json.",
  );
} finally {
  await browser?.close();
  server.kill();
}
