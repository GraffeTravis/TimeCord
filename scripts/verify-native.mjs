// Drives the real Windows WebView through the official tauri-driver. Requires the verification build.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const root = process.cwd();
assert(
  !process.argv.includes("--read-only"),
  "Les tests natifs acceptent uniquement la version de vérification isolée.",
);
const binaryArg = process.argv.indexOf("--binary");
const binary =
  binaryArg === -1
    ? path.join(root, "src-tauri/target/release/timecord.exe")
    : path.resolve(process.argv[binaryArg + 1]);
const driverPath = path.join(os.homedir(), ".cargo/bin/tauri-driver.exe");
const edgePath = path.join(root, "tools/webdriver/msedgedriver.exe");
await Promise.all([access(binary), access(driverPath), access(edgePath)]);
assert(
  (await readFile(binary)).includes(Buffer.from("local.timecord.verification")),
  "Construire d’abord avec tests/native/tauri.test.conf.json : les tests doivent utiliser leur propre espace de données.",
);
const driver = spawn(
  driverPath,
  ["--port", "4444", "--native-driver", edgePath],
  { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
driver.stdout.on("data", (data) => (logs += data));
driver.stderr.on("data", (data) => (logs += data));
const base = "http://127.0.0.1:4444";
let session;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(route, body, method = "POST") {
  const response = await fetch(base + route, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(45000),
  });
  const json = await response.json();
  if (!response.ok || json.value?.error) throw new Error(JSON.stringify(json));
  return json.value;
}
async function execute(script, args = [], asynchronous = false) {
  return request(
    `/session/${session}/execute/${asynchronous ? "async" : "sync"}`,
    { script, args },
  );
}
async function invoke(command, args = {}) {
  const result = await execute(
    `const done=arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke(arguments[0],arguments[1]).then(value=>done({ok:true,value})).catch(error=>done({ok:false,error:String(error)}));`,
    [command, args],
    true,
  );
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
async function until(check, message) {
  for (let i = 0; i < 60; i++) {
    try {
      if (await check()) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(message);
}
async function click(text) {
  const clicked = await execute(
    `const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0]); if(!button)return false; button.click(); return true;`,
    [text],
  );
  assert(clicked, `Bouton absent : ${text}`);
}
async function screenshot(name) {
  const png = await request(`/session/${session}/screenshot`, undefined, "GET");
  await writeFile(
    path.join(root, "test-results", name),
    Buffer.from(png, "base64"),
  );
}
try {
  await until(
    async () => (await fetch(base + "/status")).ok,
    "Le pilote ne démarre pas.",
  );
  const created = await request("/session", {
    capabilities: { alwaysMatch: { "tauri:options": { application: binary } } },
  });
  session = created.sessionId;
  await until(
    () =>
      execute(
        `return !!window.__TAURI_INTERNALS__ && !!document.querySelector('.timer-panel');`,
      ),
    "La fenêtre native ne charge pas le suivi du temps.",
  );
  const initial = await invoke("snapshot");
  assert.equal(await execute("return location.hostname;"), "tauri.localhost");

  const project = {
    id: crypto.randomUUID(),
    name: "Projet natif de vérification",
    color: "#7760ce",
    clientId: null,
    archived: false,
  };
  await invoke("save_project", { payload: project });
  const entry = {
    id: crypto.randomUUID(),
    description: "Créneau natif de nuit",
    projectId: project.id,
    clientId: null,
    start: "2026-01-06T09:00:00.000Z",
    end: "2026-01-06T12:00:00.000Z",
  };
  await invoke("save_entry", { payload: entry });
  await assert.rejects(
    () =>
      invoke("save_entry", {
        payload: {
          ...entry,
          id: crypto.randomUUID(),
          start: "2026-01-06T10:00:00Z",
        },
      }),
    /chevauche/,
  );
  await invoke("start_timer", {
    payload: {
      description: "Chronomètre natif",
      projectId: project.id,
      clientId: null,
    },
  });
  const beforeReload = await invoke("snapshot");
  await request(`/session/${session}`, undefined, "DELETE");
  session = undefined;
  await sleep(800);
  const reopened = await request("/session", {
    capabilities: {
      alwaysMatch: { "tauri:options": { application: binary } },
    },
  });
  session = reopened.sessionId;
  await until(
    () =>
      execute(
        `return document.querySelector('.task-input')?.value==='Chronomètre natif';`,
      ),
    "Le chronomètre ne réapparaît pas.",
  );
  assert.equal(
    (await invoke("snapshot")).timer.start,
    beforeReload.timer.start,
  );
  const secondInstance = spawn(binary, [], {
    windowsHide: true,
    stdio: "ignore",
  });
  await Promise.race([
    new Promise((resolve, reject) =>
      secondInstance.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Seconde instance : ${code}`)),
      ),
    ),
    sleep(10000).then(() => {
      if (secondInstance.exitCode === null) {
        secondInstance.kill();
        throw new Error("La seconde instance ne s’arrête pas.");
      }
    }),
  ]);
  await click("Arrêter");
  await until(
    async () => !(await invoke("snapshot")).timer,
    "Le chronomètre ne s’arrête pas.",
  );
  await click("Tout");
  await until(
    () =>
      execute(
        `return document.body.textContent.includes('Créneau natif de nuit');`,
      ),
    "L’historique ne se charge pas.",
  );
  await mkdir(path.join(root, "test-results"), { recursive: true });
  await screenshot("native-tracking.png");
  await click("Rapports");
  await until(
    () => execute(`return !!document.querySelector('.recharts-wrapper');`),
    "Le graphique natif ne se charge pas.",
  );
  await screenshot("native-reports.png");
  await click("Calendrier");
  await until(
    () => execute(`return !!document.querySelector('.fc');`),
    "Le calendrier natif ne se charge pas.",
  );
  await screenshot("native-calendar.png");
  const blocked = await execute(
    `const done=arguments[arguments.length-1]; fetch('https://example.com').then(()=>done(false)).catch(()=>done(true));`,
    [],
    true,
  );
  assert(blocked, "La CSP autorise une connexion externe.");
  await assert.rejects(
    () => invoke("plugin:fs|read_text_file", { path: "C:\\Windows\\win.ini" }),
    /not allowed|not found|denied|forbidden/i,
  );
  await assert.rejects(
    () =>
      invoke("plugin:webview|create_webview_window", {
        options: { label: "extra", url: "https://example.com" },
      }),
    /not allowed|not found|denied|forbidden/i,
  );
  await request(`/session/${session}/url`, {
    url: "https://example.com",
  }).catch(() => {});
  assert.equal(await execute("return location.hostname;"), "tauri.localhost");
  // Keep the verification database separate; remove only this run’s entries and archive its project.
  const final = await invoke("snapshot");
  for (const item of final.entries.filter((e) => e.projectId === project.id))
    await invoke("delete_entry", { payload: item.id });
  await invoke("save_project", { payload: { ...project, archived: true } });
  console.log(
    `Fenêtre Windows : chargement, vraies commandes SQLite, chronomètre, historique, graphiques, calendrier, CSP et permissions validés. ${initial.entries.length} entrée(s) préexistante(s) dans l’espace de vérification.`,
  );
} catch (error) {
  console.error(logs.slice(-4000));
  throw error;
} finally {
  if (session)
    await request(`/session/${session}`, undefined, "DELETE").catch(() => {});
  driver.kill();
}
