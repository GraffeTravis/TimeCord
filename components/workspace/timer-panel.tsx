"use client";
import type { Project, Snapshot } from "@/lib/schema";
import { duration } from "@/lib/time";
import { ArrowUpRight, FolderKanban, Play, Square, Users } from "lucide-react";
import { colors, type Mutate, type Setter } from "./types";
export function TimerPanel({
  data,
  busy,
  description,
  setDescription,
  projectId,
  setProjectId,
  clientId,
  setClientId,
  projectById,
  timerSeconds,
  mutate,
  setNotice,
  setProjectDraft,
}: {
  data: Snapshot;
  busy: boolean;
  description: string;
  setDescription: Setter<string>;
  projectId: string;
  setProjectId: Setter<string>;
  clientId: string;
  setClientId: Setter<string>;
  projectById: Record<string, Project>;
  timerSeconds: number;
  mutate: Mutate;
  setNotice: Setter<string>;
  setProjectDraft: Setter<Project | null>;
}) {
  return (
    <section
      className={`timer-panel ${data.timer ? "running" : ""}`}
      aria-label="Chronomètre"
    >
      <div className="timer-top">
        <span>
          <span className="tiny-dot" />
          {data.timer
            ? "CHRONOMÈTRE EN COURS"
            : "À QUOI CONSACREZ-VOUS VOTRE TEMPS ?"}
        </span>
        <span>Chaque minute compte.</span>
      </div>
      <div className="timer-main">
        <div className="timer-fields">
          <label className="sr-only" htmlFor="task">
            Tâche à chronométrer
          </label>
          <input
            id="task"
            className="task-input"
            placeholder="Sur quoi travaillez-vous ?"
            value={data.timer?.description ?? description}
            disabled={!!data.timer || busy}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
          <div className="timer-selects">
            <FolderKanban size={16} />
            <select
              aria-label="Projet du chronomètre"
              value={data.timer?.projectId ?? projectId}
              disabled={!!data.timer || busy}
              onChange={(e) => {
                setProjectId(e.target.value);
                setClientId(projectById[e.target.value]?.clientId || "");
              }}
            >
              <option value="">Choisir un projet</option>
              {data.projects
                .filter((p) => !p.archived || p.id === data.timer?.projectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <span className="divider" />
            <Users size={16} />
            <select
              aria-label="Client du chronomètre"
              value={data.timer ? data.timer.clientId || "" : clientId}
              disabled={!!data.timer || busy}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Sans client</option>
              {data.clients
                .filter((c) => !c.archived || c.id === data.timer?.clientId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="timer-controls">
          <span className="timer-digits" aria-live="off">
            {duration(timerSeconds)}
          </span>
          <button
            className={`button ${data.timer ? "stop" : "primary"}`}
            disabled={
              busy || (!data.timer && (!description.trim() || !projectId))
            }
            onClick={async () => {
              if (
                await mutate(data.timer ? "stopTimer" : "startTimer", {
                  description,
                  projectId,
                  clientId: clientId || null,
                })
              ) {
                if (data.timer) setNotice("Temps enregistré.");
                else setDescription("");
              }
            }}
          >
            {data.timer ? (
              <Square size={15} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
            {data.timer ? "Arrêter" : "Démarrer"}
          </button>
        </div>
      </div>
      {!data.projects.some((p) => !p.archived) && (
        <div className="timer-hint">
          Pour commencer,{" "}
          <button
            className="text-button"
            onClick={() =>
              setProjectDraft({
                id: crypto.randomUUID(),
                name: "",
                color: colors[0],
                clientId: null,
                archived: false,
              })
            }
          >
            créez votre premier projet <ArrowUpRight size={13} />
          </button>
        </div>
      )}
    </section>
  );
}
