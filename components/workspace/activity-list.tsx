"use client";
import { sumPeriod, type PeriodBounds } from "@/lib/reports";
import type { Client, Entry, Project, Snapshot } from "@/lib/schema";
import {
  dateKey,
  duration,
  localInput,
  niceDay,
  secondsBetween,
} from "@/lib/time";
import { Pencil, Play, ShieldCheck, Timer as TimerIcon } from "lucide-react";
import { Empty } from "./shared";
import { type Mutate } from "./types";
export function ActivityList({
  data,
  filtered,
  grouped,
  total,
  today,
  zone,
  bounds,
  projectById,
  clientById,
  busy,
  editEntry,
  mutate,
}: {
  data: Snapshot;
  filtered: Entry[];
  grouped: [string, Entry[]][];
  total: number;
  today: string;
  zone: string;
  bounds: PeriodBounds | null;
  projectById: Record<string, Project>;
  clientById: Record<string, Client>;
  busy: boolean;
  editEntry: (entry: Entry) => void;
  mutate: Mutate;
}) {
  return (
    <>
      <div className="activity-total">
        <span>Temps enregistré sur la période</span>
        <strong>{duration(total)}</strong>
      </div>
      {!filtered.length ? (
        <Empty
          icon={<TimerIcon size={28} />}
          title={
            data.entries.length
              ? "Aucun résultat sur cette période"
              : "Votre première minute commence ici"
          }
          text={
            data.entries.length
              ? "Ajustez les dates ou les filtres pour retrouver votre activité."
              : "Lancez le chronomètre ou ajoutez une plage de travail déjà effectuée."
          }
        />
      ) : (
        grouped.map(([day, list]) => (
          <section className="day-group" key={day}>
            <div className="day-heading">
              <span>
                {day === today ? "Aujourd’hui" : niceDay(day)}
                <small>{day === today ? niceDay(day) : ""}</small>
              </span>
              <strong>{duration(sumPeriod(list, bounds))}</strong>
            </div>
            {list.map((e) => (
              <div className="entry-row" key={e.id}>
                <span
                  className="project-line"
                  style={{
                    background: projectById[e.projectId]?.color,
                  }}
                />
                <div className="entry-description">
                  <strong>{e.description}</strong>
                  <div>
                    <span
                      className="project-label"
                      style={{
                        color: projectById[e.projectId]?.color,
                      }}
                    >
                      <span
                        className="color-dot"
                        style={{
                          background: projectById[e.projectId]?.color,
                        }}
                      />
                      {projectById[e.projectId]?.name}
                    </span>
                    {e.clientId && (
                      <>
                        <span className="separator">/</span>
                        <span>{clientById[e.clientId]?.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="entry-times">
                  {localInput(e.start, zone).slice(11)} —{" "}
                  {localInput(e.end, zone).slice(11)}
                  {dateKey(e.end, zone) !== dateKey(e.start, zone) && (
                    <small>
                      jusqu’au{" "}
                      {dateKey(e.end, zone).split("-").reverse().join("/")}
                    </small>
                  )}
                </span>
                <strong
                  className="entry-duration"
                  title="Durée complète du créneau"
                >
                  {duration(secondsBetween(e.start, e.end))}
                </strong>
                <div className="entry-actions">
                  <button
                    className="icon-button"
                    aria-label={`Modifier ${e.description}`}
                    title="Modifier"
                    onClick={() => editEntry(e)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Reprendre ${e.description}`}
                    title="Reprendre avec un nouveau chronomètre"
                    disabled={
                      busy ||
                      !!data.timer ||
                      projectById[e.projectId]?.archived ||
                      (!!e.clientId && clientById[e.clientId]?.archived)
                    }
                    onClick={() =>
                      void mutate("startTimer", {
                        description: e.description,
                        projectId: e.projectId,
                        clientId: e.clientId,
                      })
                    }
                  >
                    <Play size={15} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))
      )}
      <div className="table-foot">
        <ShieldCheck size={14} />
        <span>Enregistré sur cet ordinateur</span>
        <span className="push-right">
          Fuseau : {zone} · Totaux limités à la période sélectionnée
        </span>
      </div>
    </>
  );
}
