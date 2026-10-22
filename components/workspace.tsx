"use client";

import {
  desktopError,
  desktopReady,
  exportBackup,
  importBackup,
  loadSnapshot,
  mutateSnapshot,
  saveCSV,
} from "@/lib/desktop";
import { dailyChart, reportCSV, selectPeriod, sumPeriod } from "@/lib/reports";
import type { Client, Entry, Project, Snapshot } from "@/lib/schema";
import {
  clipSeconds,
  dateKey,
  hours,
  localInput,
  monday,
  nextDay,
  secondsBetween,
  startOfDay,
} from "@/lib/time";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  FolderKanban,
  LoaderCircle,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityList } from "./workspace/activity-list";
import { CalendarView } from "./workspace/calendar-view";
import { WorkspaceDialogs } from "./workspace/dialogs";
import { ProjectsView } from "./workspace/projects-view";
import { ReportsView } from "./workspace/reports-view";
import { SettingsView } from "./workspace/settings-view";
import { Stat } from "./workspace/shared";
import { TimerPanel } from "./workspace/timer-panel";
import type { EntryDraft } from "./workspace/types";

type View = "tracking" | "calendar" | "reports" | "projects" | "settings";
const labels: Record<View, string> = {
  tracking: "Suivi du temps",
  calendar: "Calendrier",
  reports: "Rapports",
  projects: "Projets & clients",
  settings: "Paramètres",
};
const empty: Snapshot = {
  clients: [],
  projects: [],
  entries: [],
  timer: null,
  settings: { timezone: "Pacific/Tahiti", weeklyGoal: 35 },
};
export default function Workspace() {
  const [data, setData] = useState<Snapshot>(empty);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("tracking");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [query, setQuery] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [periodInitialized, setPeriodInitialized] = useState(false);
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const [projectDraft, setProjectDraft] = useState<Project | null>(null);
  const [clientDraft, setClientDraft] = useState<Client | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(empty.settings);
  const zone = data.settings.timezone;
  const today = dateKey(now, zone);
  const refresh = useCallback(async () => {
    try {
      if (!desktopReady())
        throw new Error(
          "Ouvrez Timecord depuis l’application Windows. Cette page seule ne peut pas accéder aux données.",
        );
      const next = await loadSnapshot();
      setData(next);
      setLoaded(true);
    } catch (e) {
      setError(desktopError(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (loaded && !periodInitialized) {
      setFrom(monday(today));
      setTo(nextDay(monday(today), 6));
      setPeriodInitialized(true);
    }
  }, [loaded, today, periodInitialized]);
  useEffect(() => {
    setSettingsDraft(data.settings);
  }, [data.settings.timezone, data.settings.weeklyGoal]); // Keep an unsaved form intact during polling.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(id);
  }, [notice]);

  async function mutate(action: string, payload?: unknown) {
    setBusy(true);
    setError("");
    try {
      const next = await mutateSnapshot(action, payload);
      setData(next);
      setNow(Date.now());
      return true;
    } catch (e) {
      setError(desktopError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function newEntry(start?: string) {
    const end = localInput(now, zone);
    setEntryDraft({
      id: crypto.randomUUID(),
      description: "",
      projectId: projectId || data.projects.find((p) => !p.archived)?.id || "",
      clientId: "",
      start: start || localInput(now - 3600000, zone),
      end: start
        ? `${start.slice(0, 10)}T${start.slice(11, 13) === "23" ? "23:59" : `${String(Number(start.slice(11, 13)) + 1).padStart(2, "0")}:00`}`
        : end,
    });
  }
  function editEntry(e: Entry) {
    setEntryDraft({
      ...e,
      clientId: e.clientId || "",
      start: localInput(e.start, zone, true),
      end: localInput(e.end, zone, true),
    });
  }
  const projectById = useMemo(
    () => Object.fromEntries(data.projects.map((p) => [p.id, p])),
    [data.projects],
  );
  const clientById = useMemo(
    () => Object.fromEntries(data.clients.map((c) => [c.id, c])),
    [data.clients],
  );
  const selection = useMemo(
    () => selectPeriod(from, to, zone),
    [from, to, zone],
  );
  const bounds = selection.bounds;
  const canExport = bounds !== null;
  const filtered = useMemo(
    () =>
      !bounds
        ? []
        : data.entries
            .filter(
              (e) =>
                (!filterProject || e.projectId === filterProject) &&
                (!filterClient ||
                  (filterClient === "none"
                    ? !e.clientId
                    : e.clientId === filterClient)) &&
                (!query ||
                  `${e.description} ${projectById[e.projectId]?.name || ""} ${e.clientId ? clientById[e.clientId]?.name || "" : ""}`
                    .toLocaleLowerCase("fr")
                    .includes(query.toLocaleLowerCase("fr"))) &&
                clipSeconds(e.start, e.end, bounds.start, bounds.end) > 0,
            )
            .sort((a, b) => b.start.localeCompare(a.start)),
    [
      data.entries,
      filterProject,
      filterClient,
      query,
      bounds,
      projectById,
      clientById,
      from,
      to,
    ],
  );
  const total = sumPeriod(filtered, bounds);
  const todayBounds = useMemo(
    () => ({
      start: startOfDay(today, zone),
      end: startOfDay(nextDay(today), zone),
    }),
    [today, zone],
  );
  const weekBounds = useMemo(
    () => ({
      start: startOfDay(monday(today), zone),
      end: startOfDay(nextDay(monday(today), 7), zone),
    }),
    [today, zone],
  );
  const todaySeconds = sumPeriod(data.entries, todayBounds);
  const weekSeconds = sumPeriod(data.entries, weekBounds);
  const timerSeconds = data.timer
    ? secondsBetween(data.timer.start, new Date(now).toISOString())
    : 0;
  const grouped = useMemo(() => {
    const groups: Record<string, Entry[]> = {};
    for (const e of filtered) {
      const day = dateKey(e.start, zone);
      (groups[day] ??= []).push(e);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered, zone]);
  const distribution = data.projects
    .map((p) => ({
      ...p,
      seconds: sumPeriod(
        filtered.filter((e) => e.projectId === p.id),
        bounds,
      ),
    }))
    .filter((p) => p.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
  const clientDistribution = [
    ...data.clients.map((c) => ({ id: c.id, name: c.name })),
    { id: "", name: "Sans client" },
  ]
    .map((c) => ({
      ...c,
      seconds: sumPeriod(
        filtered.filter((e) => (e.clientId || "") === c.id),
        bounds,
      ),
    }))
    .filter((c) => c.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
  const chart = useMemo(
    () => dailyChart(filtered, from, to, zone),
    [filtered, from, to, zone],
  );
  function period(kind: "week" | "month" | "all") {
    if (kind === "week") {
      setFrom(monday(today));
      setTo(nextDay(monday(today), 6));
    }
    if (kind === "month") {
      setFrom(`${today.slice(0, 7)}-01`);
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + 1, 0);
      setTo(d.toISOString().slice(0, 10));
    }
    if (kind === "all") {
      const sorted = [...data.entries].sort((a, b) =>
        a.start.localeCompare(b.start),
      );
      setFrom(sorted.length ? dateKey(sorted[0].start, zone) : today);
      setTo(
        sorted.length
          ? [today, ...sorted.map((e) => dateKey(e.end, zone))].sort().at(-1)!
          : today,
      );
    }
  }
  async function exportCSV() {
    if (!bounds) return;
    setBusy(true);
    setError("");
    try {
      if (
        await saveCSV(
          reportCSV(filtered, projectById, clientById, zone, bounds),
        )
      )
        setNotice("Export CSV enregistré.");
    } catch (error) {
      setError(desktopError(error));
    } finally {
      setBusy(false);
    }
  }
  async function backup() {
    setBusy(true);
    setError("");
    try {
      if (await exportBackup()) setNotice("Sauvegarde enregistrée.");
    } catch (error) {
      setError(desktopError(error));
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    setBusy(true);
    setError("");
    try {
      const restored = await importBackup();
      if (restored) {
        setData(restored);
        setNotice("Sauvegarde restaurée.");
        setProjectId("");
        setClientId("");
        setFilterProject("");
        setFilterClient("");
        setFrom("");
        setTo("");
        setPeriodInitialized(false);
      }
    } catch (error) {
      setError(desktopError(error));
    } finally {
      setBusy(false);
    }
  }
  const navigation = [
    { id: "tracking" as const, icon: Clock3 },
    { id: "calendar" as const, icon: CalendarDays },
    { id: "reports" as const, icon: BarChart3 },
    { id: "projects" as const, icon: FolderKanban },
  ];
  const modalOpen = !!(entryDraft || projectDraft || clientDraft);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Timecord accueil">
          <span className="brand-mark">
            <Clock3 size={23} />
          </span>
          timecord<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">ESPACE PERSONNEL</div>
        <div className="workspace-card">
          <div className="avatar">M</div>
          <div>
            <strong>Mon espace</strong>
            <span>Suivi personnel</span>
          </div>
          <span className="tiny-dot" />
        </div>
        <div className="nav-caption">VOTRE ACTIVITÉ</div>
        <nav aria-label="Navigation principale">
          {navigation.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => setView(id)}
            >
              <Icon size={19} />
              {labels[id]}
              {view === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={21} />
            <strong>Votre temps vous appartient.</strong>
            <p>
              Vos données restent ici,
              <br />
              sur votre ordinateur.
            </p>
            <span>
              <span className="tiny-dot" /> 100 % local
            </span>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            <Settings2 size={19} />
            Paramètres
          </button>
          <div className="sidebar-foot">
            TIMECORD <span>v1.1</span>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Mon espace <ChevronRight size={14} />
            <span>{labels[view]}</span>
          </div>
          <div className="top-right">
            <span className="local-badge">
              <span className="tiny-dot" /> Stockage local
            </span>
            <span className="avatar small">M</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">UN PEU PLUS DE CLARTÉ, CHAQUE JOUR</div>
              <h1>{labels[view]}</h1>
              <p>
                {view === "tracking"
                  ? "Faites de la place pour ce qui compte. Le reste, on le chronomètre."
                  : view === "calendar"
                    ? "Prenez du recul sur le rythme de vos journées."
                    : view === "reports"
                      ? "Comprenez où va votre temps, pour mieux le choisir."
                      : view === "projects"
                        ? "Un endroit pour chaque projet, un cap pour votre travail."
                        : "Un espace à votre mesure. Des données sous votre contrôle."}
              </p>
            </div>
            {["tracking", "calendar"].includes(view) && (
              <button
                className="button secondary"
                onClick={() => newEntry()}
                disabled={!loaded || !data.projects.some((p) => !p.archived)}
              >
                <Plus size={17} />
                Ajouter du temps
              </button>
            )}
          </div>
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button aria-label="Fermer l’erreur" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {!loaded ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              Ouverture de vos données locales…
              <button
                className="button secondary"
                onClick={() => void refresh()}
              >
                Réessayer
              </button>
            </div>
          ) : (
            <>
              {(view === "tracking" || view === "reports") && (
                <div className="stats-grid">
                  <Stat
                    label="AUJOURD’HUI"
                    value={hours(todaySeconds)}
                    icon={<Clock3 size={18} />}
                    detail={
                      data.timer
                        ? "Un chronomètre est en cours"
                        : "Temps enregistré"
                    }
                  />
                  <Stat
                    label="CETTE SEMAINE"
                    value={hours(weekSeconds)}
                    icon={<CalendarDays size={18} />}
                    detail={`Objectif de ${data.settings.weeklyGoal} h`}
                    progress={Math.min(
                      100,
                      weekSeconds / (data.settings.weeklyGoal * 36),
                    )}
                  />
                  <Stat
                    label="PROJETS ACTIFS"
                    value={String(
                      data.projects.filter((p) => !p.archived).length,
                    ).padStart(2, "0")}
                    icon={<FolderKanban size={18} />}
                    detail={`${data.clients.filter((c) => !c.archived).length} client${data.clients.filter((c) => !c.archived).length > 1 ? "s" : ""} dans votre espace`}
                  />
                </div>
              )}
              {view === "tracking" && (
                <TimerPanel
                  data={data}
                  busy={busy}
                  description={description}
                  setDescription={setDescription}
                  projectId={projectId}
                  setProjectId={setProjectId}
                  clientId={clientId}
                  setClientId={setClientId}
                  projectById={projectById}
                  timerSeconds={timerSeconds}
                  mutate={mutate}
                  setNotice={setNotice}
                  setProjectDraft={setProjectDraft}
                />
              )}
              {["tracking", "reports", "calendar"].includes(view) && (
                <>
                  <div className="section-heading">
                    <h2>
                      {view === "tracking"
                        ? "Votre activité"
                        : view === "calendar"
                          ? "Vos créneaux de travail"
                          : "Vue d’ensemble"}
                      <span className="count">{filtered.length}</span>
                    </h2>
                    <div className="periods">
                      <button onClick={() => period("week")}>
                        Cette semaine
                      </button>
                      <button onClick={() => period("month")}>Ce mois</button>
                      <button onClick={() => period("all")}>Tout</button>
                    </div>
                  </div>
                  <div className="filters">
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="Rechercher une tâche"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher une tâche…"
                      />
                    </label>
                    <select
                      aria-label="Filtrer par projet"
                      value={filterProject}
                      onChange={(e) => setFilterProject(e.target.value)}
                    >
                      <option value="">Tous les projets</option>
                      {data.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.archived ? " (archivé)" : ""}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filtrer par client"
                      value={filterClient}
                      onChange={(e) => setFilterClient(e.target.value)}
                    >
                      <option value="">Tous les clients</option>
                      <option value="none">Sans client</option>
                      {data.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="date-range">
                      <input
                        aria-label="Début de période"
                        type="date"
                        value={from}
                        min="2000-01-01"
                        max="2099-12-31"
                        onChange={(e) => setFrom(e.target.value)}
                      />
                      <span>→</span>
                      <input
                        aria-label="Fin de période"
                        type="date"
                        value={to}
                        min="2000-01-01"
                        max="2099-12-31"
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </div>
                    <button
                      className="icon-button export"
                      title="Exporter la sélection en CSV"
                      aria-label="Exporter la sélection en CSV"
                      onClick={exportCSV}
                      disabled={busy || !canExport}
                    >
                      <Download size={18} />
                    </button>
                  </div>
                  {selection.error && (
                    <p className="inline-error" role="alert">
                      {selection.error}
                    </p>
                  )}
                </>
              )}
              {view === "tracking" && (
                <ActivityList
                  data={data}
                  filtered={filtered}
                  grouped={grouped}
                  total={total}
                  today={today}
                  zone={zone}
                  bounds={bounds}
                  projectById={projectById}
                  clientById={clientById}
                  busy={busy}
                  editEntry={editEntry}
                  mutate={mutate}
                />
              )}
              {view === "calendar" && (
                <CalendarView
                  data={data}
                  filtered={filtered}
                  projectById={projectById}
                  from={from}
                  now={now}
                  today={today}
                  zone={zone}
                  editEntry={editEntry}
                  newEntry={newEntry}
                  setFrom={setFrom}
                  setTo={setTo}
                />
              )}
              {view === "reports" && (
                <ReportsView
                  filtered={filtered}
                  total={total}
                  chart={chart}
                  distribution={distribution}
                  clientDistribution={clientDistribution}
                  busy={busy}
                  canExport={canExport}
                  exportCSV={exportCSV}
                />
              )}
              {view === "projects" && (
                <ProjectsView
                  data={data}
                  busy={busy}
                  showArchived={showArchived}
                  setShowArchived={setShowArchived}
                  setProjectDraft={setProjectDraft}
                  setClientDraft={setClientDraft}
                  clientById={clientById}
                  mutate={mutate}
                />
              )}
              {view === "settings" && (
                <SettingsView
                  settingsDraft={settingsDraft}
                  setSettingsDraft={setSettingsDraft}
                  busy={busy}
                  mutate={mutate}
                  setNotice={setNotice}
                  backup={backup}
                  restore={restore}
                />
              )}
              <footer className="main-footer">
                <span>Un temps mieux compris. Une journée mieux vécue.</span>
                <span>
                  Conçu pour rester chez vous <ShieldCheck size={13} />
                </span>
              </footer>
            </>
          )}
        </div>
      </main>
      {modalOpen && (
        <WorkspaceDialogs
          data={data}
          busy={busy}
          error={error}
          entryDraft={entryDraft}
          setEntryDraft={setEntryDraft}
          projectDraft={projectDraft}
          setProjectDraft={setProjectDraft}
          clientDraft={clientDraft}
          setClientDraft={setClientDraft}
          setError={setError}
          setNotice={setNotice}
          mutate={mutate}
        />
      )}
    </div>
  );
}
